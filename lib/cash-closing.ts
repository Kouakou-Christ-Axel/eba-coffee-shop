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
import { getDailyStats } from '@/lib/stats';

export type CashFigures = {
  cashSales: number; // ventes encaissées en espèces
  cashExpenses: number; // dépenses payées en espèces
  waveSales: number;
  otherSales: number;
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
    otherSales: stats.revenueByPaymentMode.OTHER,
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
