// lib/jeko/stats.ts
//
// Statistiques de la page Jèko sur une plage de jours (Abidjan = UTC). `buildJekoStats`
// est pur ; `getJekoStats` le nourrit depuis la base. Sources, sans table dédiée :
//   - encaissements et frais : commandes avec `paymentTransactionId`, datées de
//     `paidAt` (remis à nul si la commande est dépayée : cumul alors légèrement
//     sous-estimé) ;
//   - conversion : commandes en ligne (`onlineFee` non nul) créées sur la plage ;
//   - remboursé / retiré : transferts de remboursement payés, retraits enregistrés.

import prisma from '@/lib/prisma';
import { formatLocalDateOnly, shiftDateString } from '@/lib/timezone';
import type { JekoAccount } from './accounts';

export type PaidRow = {
  paidAt: Date;
  jekoAccount: string;
  total: number;
  onlineFee: number | null;
  gatewayFee: number | null;
  paymentAmountDue: number | null;
};

export type CreatedRow = {
  status: string;
  paymentTransactionId: string | null;
};

export type WithdrawalRow = { createdAt: Date; amount: number; fee: number };

export type JekoStatsInput = {
  paid: PaidRow[];
  created: CreatedRow[];
  withdrawals: WithdrawalRow[];
  /** Remboursements Jèko payés sur la plage (montant + frais du transfert). */
  refunded: number;
  /** Bornes incluses, YYYY-MM-DD. */
  from: string;
  to: string;
};

export type SeriesPoint = {
  /** YYYY-MM-DD (jour) ou YYYY-MM (mois). */
  date: string;
  collected: number;
  count: number;
  /** Encaissé par compte, pour la série « Tous les comptes ». */
  A: number;
  B: number;
};

export type MonthRow = {
  month: string;
  collected: number;
  count: number;
  gatewayFees: number;
  customerFees: number;
  /** Frais Jèko moins frais payés par les clients. */
  netCost: number;
  withdrawalFees: number;
};

/** Au-delà de ce nombre de jours, la courbe passe au mois. */
export const DAILY_SERIES_MAX_DAYS = 92;

const collectedOf = (r: PaidRow) =>
  r.paymentAmountDue ?? r.total + (r.onlineFee ?? 0);

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 800; d = shiftDateString(d, 1)) {
    days.push(d);
  }
  return days;
}

export function buildJekoStats(input: JekoStatsInput) {
  const { paid, created, withdrawals, refunded, from, to } = input;
  const days = daysBetween(from, to);
  const monthly = days.length > DAILY_SERIES_MAX_DAYS;
  const key = (day: string) => (monthly ? day.slice(0, 7) : day);

  const series = new Map<string, SeriesPoint>();
  for (const day of days) {
    series.set(key(day), {
      date: key(day),
      collected: 0,
      count: 0,
      A: 0,
      B: 0,
    });
  }
  const months = new Map<string, MonthRow>();
  const month = (m: string) => {
    let row = months.get(m);
    if (!row) {
      row = {
        month: m,
        collected: 0,
        count: 0,
        gatewayFees: 0,
        customerFees: 0,
        netCost: 0,
        withdrawalFees: 0,
      };
      months.set(m, row);
    }
    return row;
  };

  let collected = 0;
  let gatewayFees = 0;
  let customerFees = 0;
  for (const r of paid) {
    const day = formatLocalDateOnly(r.paidAt);
    const amount = collectedOf(r);
    const point = series.get(key(day));
    if (point) {
      point.collected += amount;
      point.count += 1;
      point[r.jekoAccount === 'B' ? 'B' : 'A'] += amount;
    }
    const m = month(day.slice(0, 7));
    m.collected += amount;
    m.count += 1;
    m.gatewayFees += r.gatewayFee ?? 0;
    m.customerFees += r.onlineFee ?? 0;
    collected += amount;
    gatewayFees += r.gatewayFee ?? 0;
    customerFees += r.onlineFee ?? 0;
  }
  for (const w of withdrawals) {
    month(formatLocalDateOnly(w.createdAt).slice(0, 7)).withdrawalFees += w.fee;
  }
  for (const m of months.values()) m.netCost = m.gatewayFees - m.customerFees;

  const paidCount = created.filter((o) => o.paymentTransactionId).length;
  const failedCount = created.filter(
    (o) => !o.paymentTransactionId && o.status === 'CANCELLED'
  ).length;
  const pendingCount = created.length - paidCount - failedCount;
  const settled = paidCount + failedCount;

  return {
    granularity: monthly ? ('month' as const) : ('day' as const),
    series: [...series.values()],
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    totals: {
      collected,
      count: paid.length,
      averageBasket: paid.length ? Math.round(collected / paid.length) : 0,
      gatewayFees,
      customerFees,
      netCost: gatewayFees - customerFees,
      refunded,
      withdrawn: withdrawals.reduce((s, w) => s + w.amount, 0),
      withdrawalFees: withdrawals.reduce((s, w) => s + w.fee, 0),
    },
    conversion: {
      created: created.length,
      paid: paidCount,
      failed: failedCount,
      pending: pendingCount,
      /** Payées / (payées + expirées ou annulées) : les en-cours ne comptent pas. */
      successRate: settled ? paidCount / settled : null,
    },
  };
}

export type JekoStats = ReturnType<typeof buildJekoStats>;

/** `from` / `to` : jours civils inclus (YYYY-MM-DD). `account: null` = tous. */
export async function getJekoStats(args: {
  account: JekoAccount | null;
  from: string;
  to: string;
}): Promise<JekoStats> {
  const { account, from, to } = args;
  const start = new Date(`${from}T00:00:00.000Z`);
  const endExclusive = new Date(`${shiftDateString(to, 1)}T00:00:00.000Z`);
  const ofAccount = account ? { jekoAccount: account } : {};

  const [paid, created, withdrawals, refunds] = await Promise.all([
    // staff-visibility: exempt — comptabilité de l'argent reçu, pas une file staff
    prisma.order.findMany({
      where: {
        paymentTransactionId: { not: null },
        paidAt: { gte: start, lt: endExclusive },
        ...ofAccount,
      },
      select: {
        paidAt: true,
        jekoAccount: true,
        total: true,
        onlineFee: true,
        gatewayFee: true,
        paymentAmountDue: true,
      },
    }),
    // staff-visibility: exempt — statistique de conversion, pas une file staff
    prisma.order.findMany({
      where: {
        onlineFee: { not: null },
        createdAt: { gte: start, lt: endExclusive },
        ...ofAccount,
      },
      select: { status: true, paymentTransactionId: true },
    }),
    prisma.jekoWithdrawal.findMany({
      where: { createdAt: { gte: start, lt: endExclusive }, ...ofAccount },
      select: { createdAt: true, amount: true, fee: true },
    }),
    prisma.refund.aggregate({
      where: {
        delivery: 'JEKO_TRANSFER',
        status: 'PAID',
        payoutDate: { gte: start, lt: endExclusive },
        ...(account ? { order: ofAccount } : {}),
      },
      _sum: { amount: true, feeFcfa: true },
    }),
  ]);

  return buildJekoStats({
    paid: paid.filter((o): o is typeof o & { paidAt: Date } => !!o.paidAt),
    created,
    withdrawals,
    refunded: (refunds._sum.amount ?? 0) + (refunds._sum.feeFcfa ?? 0),
    from,
    to,
  });
}

/** Date du premier paiement encaissé (pour « Tout »), ou `null` s'il n'y en a pas. */
export async function getEarliestJekoPayment(
  account: JekoAccount | null
): Promise<string | null> {
  // staff-visibility: exempt — comptabilité de l'argent reçu, pas une file staff
  const first = await prisma.order.aggregate({
    where: {
      paymentTransactionId: { not: null },
      paidAt: { not: null },
      ...(account ? { jekoAccount: account } : {}),
    },
    _min: { paidAt: true },
  });
  return first._min.paidAt ? formatLocalDateOnly(first._min.paidAt) : null;
}
