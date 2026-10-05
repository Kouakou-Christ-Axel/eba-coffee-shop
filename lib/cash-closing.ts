// lib/cash-closing.ts
//
// Lecture + calcul pour la clôture de caisse (journalière, espèces). Les
// écritures vivent dans lib/cash-closing-mutations.ts.
//
// Périmètre : on réconcilie le LIQUIDE. La caisse théorique espèces vaut
//   fond de caisse + ventes encaissées en espèces − dépenses payées en espèces.
// Wave / Autre sont des paiements électroniques : affichés pour information,
// hors réconciliation du tiroir.

import prisma from '@/lib/prisma';
import { PAYMENT_MODES } from '@/lib/payment-modes';
import { getDailyStats } from '@/lib/stats';

// Modes affichés à part ; tous les autres (MTN, Moov, Djamo, Autre…) sont
// regroupés dans `otherSales`, de sorte que le détail somme toujours au total.
const NAMED_MODES = ['CASH', 'WAVE', 'ORANGE_MONEY'];

export type CashFigures = {
  cashSales: number; // ventes encaissées en espèces
  cashExpenses: number; // dépenses payées en espèces
  waveSales: number;
  orangeMoneySales: number;
  otherSales: number; // MTN, Moov, Djamo et Autre
  totalRevenue: number; // CA encaissé tous modes
};

/** Chiffres liquides d'un jour civil (réutilise getDailyStats + dépenses). */
export async function getCashFigures(date: Date): Promise<CashFigures> {
  const [stats, expAgg] = await Promise.all([
    getDailyStats(date),
    prisma.expense.aggregate({
      where: { date, paymentMethod: 'CASH' },
      _sum: { amount: true },
    }),
  ]);
  return {
    cashSales: stats.revenueByPaymentMode.CASH,
    cashExpenses: expAgg._sum.amount ?? 0,
    waveSales: stats.revenueByPaymentMode.WAVE,
    orangeMoneySales: stats.revenueByPaymentMode.ORANGE_MONEY,
    otherSales: PAYMENT_MODES.filter((m) => !NAMED_MODES.includes(m)).reduce(
      (sum, m) => sum + stats.revenueByPaymentMode[m],
      0
    ),
    totalRevenue: stats.revenue,
  };
}

/** Clôture enregistrée pour un jour (ou null). */
export async function getCashClosing(date: Date) {
  return prisma.cashClosing.findUnique({
    where: { date },
    include: { closedBy: { select: { name: true, email: true } } },
  });
}

/** Historique des clôtures sur une plage de jours civils (inclusive). */
export async function listCashClosings(from: Date, to: Date) {
  return prisma.cashClosing.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: 'desc' },
    include: { closedBy: { select: { name: true, email: true } } },
  });
}
