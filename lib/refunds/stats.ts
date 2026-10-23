// lib/refunds/stats.ts
//
// Statistiques de remboursements sur une plage de jours civils. Le montant et la
// date sont ceux de l'argent qui part (`payoutDate`, statut PAID). Taux = part du
// CA brut ; coût = frais de transfert Jèko payés (les frais en ligne du client
// restent acquis, ils ne sont pas rendus).

import type { PaymentMode, RefundReason } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { getRangeStats } from '@/lib/stats';
import { emptyModeRecord } from '@/lib/payment-modes';
import { userLabel } from './labels';
import { countRefundQueues } from './queries';

export type RefundStats = {
  from: Date;
  to: Date;
  count: number;
  amount: number;
  /** Part du CA brut de la plage (0..1), remboursements comptés dans le CA. */
  rateOfGrossRevenue: number;
  transferFees: number;
  byReason: { reason: RefundReason; count: number; amount: number }[];
  byChannel: Record<PaymentMode, number>;
  byRequester: { name: string | null; count: number; amount: number }[];
  byApprover: { name: string | null; count: number; amount: number }[];
  byProduct: { name: string; quantity: number; amount: number }[];
  /** Transferts Jèko en échec ou à vérifier / transferts tentés (0..1). */
  transferFailureRate: number;
  /** Délai moyen demande → validation, en minutes (null si aucune validation). */
  avgApprovalMinutes: number | null;
  queues: { toApprove: number; toFix: number; inProgress: number };
};

export async function getRefundStats(
  from: Date,
  to: Date
): Promise<RefundStats> {
  const paidWhere = {
    status: 'PAID' as const,
    payoutDate: { gte: from, lte: to },
  };
  const created = {
    gte: from,
    lt: new Date(to.getTime() + 24 * 60 * 60 * 1000),
  };

  const [paid, byProductRows, transfers, approved, queues, range] =
    await Promise.all([
      prisma.refund.findMany({
        where: paidWhere,
        select: {
          amount: true,
          reason: true,
          channel: true,
          feeFcfa: true,
          creditSourceId: true,
          order: { select: { isPaid: true, status: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.refundLine.findMany({
        where: { refund: paidWhere },
        select: {
          name: true,
          kind: true,
          quantity: true,
          amount: true,
          productId: true,
        },
      }),
      prisma.refund.groupBy({
        by: ['status'],
        where: {
          delivery: 'JEKO_TRANSFER',
          attempt: { gt: 0 },
          createdAt: created,
        },
        _count: true,
      }),
      prisma.refund.findMany({
        where: { approvedAt: { not: null }, createdAt: created },
        select: { createdAt: true, approvedAt: true },
      }),
      countRefundQueues(),
      getRangeStats(from, to),
    ]);

  const byReason = new Map<RefundReason, { count: number; amount: number }>();
  const byRequester = new Map<
    string,
    { name: string | null; count: number; amount: number }
  >();
  const byApprover = new Map<
    string,
    { name: string | null; count: number; amount: number }
  >();
  const byChannel = emptyModeRecord();
  let amount = 0;
  let counted = 0;
  let fees = 0;

  const bump = (
    map: Map<string, { name: string | null; count: number; amount: number }>,
    user: { id: string; name: string | null; email: string } | null,
    value: number
  ) => {
    const key = user?.id ?? '—';
    const cur = map.get(key) ?? {
      name: userLabel(user),
      count: 0,
      amount: 0,
    };
    map.set(key, { ...cur, count: cur.count + 1, amount: cur.amount + value });
  };

  for (const r of paid) {
    amount += r.amount;
    fees += r.feeFcfa;
    byChannel[r.channel] += r.amount;
    const reason = byReason.get(r.reason) ?? { count: 0, amount: 0 };
    byReason.set(r.reason, {
      count: reason.count + 1,
      amount: reason.amount + r.amount,
    });
    bump(byRequester, r.requestedBy, r.amount);
    bump(byApprover, r.approvedBy, r.amount);
    // Une conversion d'avoir ne retire pas de CA une 2e fois (cf. aggregate.ts).
    if (r.order.isPaid && r.order.status !== 'CANCELLED' && !r.creditSourceId)
      counted += r.amount;
  }

  const productTotals = new Map<
    string,
    { name: string; quantity: number; amount: number }
  >();
  for (const l of byProductRows) {
    const key = `${l.kind}|${l.productId}|${l.name}`;
    const cur = productTotals.get(key) ?? {
      name: l.name,
      quantity: 0,
      amount: 0,
    };
    productTotals.set(key, {
      ...cur,
      quantity: cur.quantity + l.quantity,
      amount: cur.amount + l.amount,
    });
  }

  const attempted = transfers.reduce((s, g) => s + g._count, 0);
  const failed = transfers
    .filter((g) => g.status === 'FAILED' || g.status === 'UNCERTAIN')
    .reduce((s, g) => s + g._count, 0);
  const delays = approved.map(
    (a) => (a.approvedAt!.getTime() - a.createdAt.getTime()) / 60_000
  );

  const sortDesc = <T extends { amount: number }>(rows: T[]) =>
    rows.sort((a, b) => b.amount - a.amount);

  return {
    from,
    to,
    count: paid.length,
    amount,
    rateOfGrossRevenue:
      range.grossRevenue > 0 ? counted / range.grossRevenue : 0,
    transferFees: fees,
    byReason: sortDesc([...byReason].map(([reason, v]) => ({ reason, ...v }))),
    byChannel,
    byRequester: sortDesc([...byRequester.values()]),
    byApprover: sortDesc([...byApprover.values()]),
    byProduct: sortDesc([...productTotals.values()]),
    transferFailureRate: attempted > 0 ? failed / attempted : 0,
    avgApprovalMinutes:
      delays.length > 0
        ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
        : null,
    queues,
  };
}
