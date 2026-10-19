// lib/refunds/aggregate.ts
//
// Point UNIQUE d'agrégation comptable des remboursements (comme
// `lib/revenue-adjustments.ts` pour les régularisations). Deux lectures
// différentes, à ne pas confondre :
//
//   - CA (`sumRefunds*`) : un remboursement ne diminue le CA QUE si sa commande y
//     est encore comptée (`isPaid` ∧ non annulée). Annuler ou dépayer la commande
//     retire déjà toute sa vente du CA : la déduire une seconde fois la compterait
//     deux fois. Évalué à la lecture, donc juste dans tous les ordres d'événements.
//   - Trésorerie (`sumCashRefundsForDay`, solde Jèko) : l'argent est réellement
//     sorti, la commande n'y change rien.
//
// Date d'effet = `payoutDate` (jour où l'argent part), jamais la demande.

import type { PaymentMode } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { emptyModeRecord } from '@/lib/payment-modes';
import { formatLocalDateOnly } from '@/lib/timezone';

/** Commande encore comptée dans le CA. */
const COUNTED_ORDER = { isPaid: true, status: { not: 'CANCELLED' } } as const;

function toModeRecord(
  grouped: { channel: PaymentMode; _sum: { amount: number | null } }[]
): Record<PaymentMode, number> {
  const rec = emptyModeRecord();
  for (const g of grouped) rec[g.channel] = g._sum.amount ?? 0;
  return rec;
}

/** Remboursements (hors CA des commandes annulées) d'un jour, par canal de sortie. */
export async function sumRefundsByModeForDay(
  date: Date
): Promise<Record<PaymentMode, number>> {
  const grouped = await prisma.refund.groupBy({
    by: ['channel'],
    where: { status: 'PAID', payoutDate: date, order: COUNTED_ORDER },
    _sum: { amount: true },
  });
  return toModeRecord(grouped);
}

/** Idem sur une plage de jours civils (inclusive). */
export async function sumRefundsByMode(
  from: Date,
  to: Date
): Promise<Record<PaymentMode, number>> {
  const grouped = await prisma.refund.groupBy({
    by: ['channel'],
    where: {
      status: 'PAID',
      payoutDate: { gte: from, lte: to },
      order: COUNTED_ORDER,
    },
    _sum: { amount: true },
  });
  return toModeRecord(grouped);
}

/** Idem par jour civil (YYYY-MM-DD). */
export async function sumRefundsByDay(
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const rows = await prisma.refund.findMany({
    where: {
      status: 'PAID',
      payoutDate: { gte: from, lte: to },
      order: COUNTED_ORDER,
    },
    select: { payoutDate: true, amount: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.payoutDate) continue;
    const key = formatLocalDateOnly(r.payoutDate);
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  return map;
}

/**
 * Espèces réellement sorties du tiroir ce jour-là, quelle que soit la commande :
 * un remboursement en espèces sur une commande annulée a quand même vidé la caisse.
 */
export async function sumCashRefundsForDay(date: Date): Promise<number> {
  const agg = await prisma.refund.aggregate({
    where: { status: 'PAID', payoutDate: date, channel: 'CASH' },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export function totalOfModes(rec: Record<PaymentMode, number>): number {
  return Object.values(rec).reduce((s, n) => s + n, 0);
}
