// Passage des lectures Prisma aux formes sérialisables des composants client.
// Le numéro de téléphone n'est montré en clair qu'aux rôles qui traitent le
// remboursement ; les rôles en lecture seule (comptable, analyste) le voient masqué.

import { maskPhone } from '@/lib/ai/assistant/mask-pii';
import type { RefundListItem } from '@/lib/refunds/queries';
import { userLabel } from '@/lib/refunds/labels';
import { getRefundDetail } from '@/lib/refunds/queries';
import type {
  RefundDetailData,
  RefundRowData,
} from './_components/refund-types';

export function toRow(r: RefundListItem): RefundRowData {
  return {
    id: r.id,
    orderId: r.orderId,
    orderRef: r.order.reference,
    dailyNumber: r.order.dailyNumber,
    amount: r.amount,
    reason: r.reason,
    source: r.source,
    status: r.status,
    delivery: r.delivery,
    channel: r.channel,
    customerName: r.customerName,
    createdAt: r.createdAt.toISOString(),
    requestedBy: userLabel(r.requestedBy),
    requestedById: r.requestedBy?.id ?? null,
  };
}

type Detail = NonNullable<Awaited<ReturnType<typeof getRefundDetail>>>;

export function toDetail(
  d: Detail,
  opts: { seePhone: boolean; convertibleCredit?: number }
): RefundDetailData {
  const iso = (v: Date | null) => (v ? v.toISOString() : null);
  return {
    id: d.id,
    orderId: d.orderId,
    orderRef: d.order.reference,
    dailyNumber: d.order.dailyNumber,
    orderTotal: d.order.total,
    amount: d.amount,
    reason: d.reason,
    source: d.source,
    status: d.status,
    delivery: d.delivery,
    channel: d.channel,
    customerName: d.customerName,
    createdAt: d.createdAt.toISOString(),
    requestedBy: userLabel(d.requestedBy),
    requestedById: d.requestedById,
    note: d.note,
    phone: d.destinationPhone
      ? opts.seePhone
        ? d.destinationPhone
        : maskPhone(d.destinationPhone)
      : null,
    convertibleCredit: opts.convertibleCredit ?? 0,
    creditSourceId: d.creditSourceId,
    failureCode: d.failureCode,
    failureMessage: d.failureMessage,
    restockItems: d.restockItems,
    stockRestoredAt: iso(d.stockRestoredAt),
    feeFcfa: d.feeFcfa,
    attempt: d.attempt,
    approvedBy: userLabel(d.approvedBy),
    approvedAt: iso(d.approvedAt),
    paidAt: iso(d.paidAt),
    payoutDate: iso(d.payoutDate),
    lines: d.lines.map((l) => ({
      id: l.id,
      name: l.kind === 'SUPPLEMENT' && l.optionName ? l.optionName : l.name,
      kind: l.kind,
      quantity: l.quantity,
      amount: l.amount,
    })),
    events: d.events.map((e) => ({
      id: e.id,
      from: e.fromStatus,
      to: e.toStatus,
      actor: userLabel(e.actor),
      note: e.note,
      at: e.createdAt.toISOString(),
    })),
  };
}
