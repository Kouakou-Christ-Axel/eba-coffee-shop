// lib/revenue-adjustments.ts
//
// Lecture des régularisations de recette (ajustements manuels du CA). Les
// écritures vivent dans lib/revenue-adjustment-mutations.ts. Les helpers
// d'agrégation sont réutilisés par lib/stats.ts (injection dans le CA) et
// lib/cash-closing.ts en hérite via getDailyStats.

import { Prisma } from '@/generated/prisma/client';
import type { PaymentMode } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';

export interface RevenueAdjustmentFilters {
  /** Plage de jours civils (Date à minuit UTC, inclusive). */
  dateFrom?: Date;
  dateTo?: Date;
  paymentMode?: PaymentMode;
}

function buildWhere({
  dateFrom,
  dateTo,
  paymentMode,
}: RevenueAdjustmentFilters): Prisma.RevenueAdjustmentWhereInput {
  const where: Prisma.RevenueAdjustmentWhereInput = {};
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }
  if (paymentMode) where.paymentMode = paymentMode;
  return where;
}

/** Liste des régularisations filtrées + total net (somme signée). */
export async function listRevenueAdjustments(
  filters: RevenueAdjustmentFilters = {}
) {
  const where = buildWhere(filters);
  const [adjustments, agg] = await Promise.all([
    prisma.revenueAdjustment.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.revenueAdjustment.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  return {
    adjustments,
    total: agg._sum.amount ?? 0,
    count: agg._count,
  };
}

export type RevenueAdjustmentSummary = {
  total: number;
  byPaymentMode: Record<PaymentMode, number>;
};

/** Total net + ventilation par mode de paiement sur une plage. */
export async function getRevenueAdjustmentSummary(
  from: Date,
  to: Date
): Promise<RevenueAdjustmentSummary> {
  const byPaymentMode = await sumAdjustmentsByMode(from, to);
  const total = byPaymentMode.CASH + byPaymentMode.WAVE + byPaymentMode.OTHER;
  return { total, byPaymentMode };
}

// ─── Helpers d'agrégation (réutilisés par lib/stats.ts) ───────────────────────

/** Somme signée des régularisations d'un jour, ventilée par mode de paiement. */
export async function sumAdjustmentsByModeForDay(
  date: Date
): Promise<Record<PaymentMode, number>> {
  const grouped = await prisma.revenueAdjustment.groupBy({
    by: ['paymentMode'],
    where: { date },
    _sum: { amount: true },
  });
  return toModeRecord(grouped);
}

/** Somme signée des régularisations sur une plage, ventilée par mode. */
export async function sumAdjustmentsByMode(
  from: Date,
  to: Date
): Promise<Record<PaymentMode, number>> {
  const grouped = await prisma.revenueAdjustment.groupBy({
    by: ['paymentMode'],
    where: { date: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return toModeRecord(grouped);
}

/** Somme signée des régularisations par jour civil (YYYY-MM-DD) sur une plage. */
export async function sumAdjustmentsByDay(
  from: Date,
  to: Date
): Promise<Map<string, number>> {
  const rows = await prisma.revenueAdjustment.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, amount: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = formatLocalDateOnly(r.date);
    map.set(key, (map.get(key) ?? 0) + r.amount);
  }
  return map;
}

function toModeRecord(
  grouped: { paymentMode: PaymentMode; _sum: { amount: number | null } }[]
): Record<PaymentMode, number> {
  const rec: Record<PaymentMode, number> = {
    CASH: 0,
    WAVE: 0,
    ORANGE_MONEY: 0,
    OTHER: 0,
  };
  for (const g of grouped) rec[g.paymentMode] = g._sum.amount ?? 0;
  return rec;
}
