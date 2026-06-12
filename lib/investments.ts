// lib/investments.ts
//
// Lecture des investissements (apports / financements) et de leurs sources
// (back-office). Miroir de lib/expenses.ts. Les écritures vivent dans
// lib/investment-mutations.ts.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export interface InvestmentFilters {
  /** Plage de jours civils (Date à minuit UTC, inclusive). */
  dateFrom?: Date;
  dateTo?: Date;
  sourceId?: string;
  reimbursable?: boolean;
}

function buildInvestmentWhere({
  dateFrom,
  dateTo,
  sourceId,
  reimbursable,
}: InvestmentFilters): Prisma.InvestmentWhereInput {
  const where: Prisma.InvestmentWhereInput = {};
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }
  if (sourceId) where.sourceId = sourceId;
  if (reimbursable !== undefined) where.reimbursable = reimbursable;
  return where;
}

/** Sources de financement triées, avec le nombre d'apports rattachés. */
export async function listInvestmentSources() {
  return prisma.investmentSource.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { investments: true } } },
  });
}

/**
 * Liste des apports filtrés + agrégats : total investi, total remboursé et
 * restant dû (sur les seuls apports remboursables).
 */
export async function listInvestments(filters: InvestmentFilters = {}) {
  const where = buildInvestmentWhere(filters);
  const [investments, agg, repayAgg] = await Promise.all([
    prisma.investment.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { source: { select: { id: true, name: true } } },
    }),
    prisma.investment.aggregate({
      where,
      _sum: { amount: true, amountRepaid: true },
      _count: true,
    }),
    // Restant dû = Σ(amount − amountRepaid) sur les apports remboursables.
    prisma.investment.aggregate({
      where: { ...where, reimbursable: true },
      _sum: { amount: true, amountRepaid: true },
    }),
  ]);

  const total = agg._sum.amount ?? 0;
  const totalRepaid = agg._sum.amountRepaid ?? 0;
  const reimbursableTotal = repayAgg._sum.amount ?? 0;
  const reimbursableRepaid = repayAgg._sum.amountRepaid ?? 0;
  const totalOutstanding = Math.max(0, reimbursableTotal - reimbursableRepaid);

  return {
    investments,
    total,
    totalRepaid,
    totalOutstanding,
    count: agg._count,
  };
}

export type InvestmentSummary = {
  total: number;
  totalOutstanding: number;
  bySource: { sourceId: string; name: string; amount: number }[];
};

/**
 * Total des apports sur une plage + ventilation par source (desc) + restant dû
 * global (sur les apports remboursables). Utilisé par la page Statistiques.
 */
export async function getInvestmentSummary(
  from: Date,
  to: Date
): Promise<InvestmentSummary> {
  const where = buildInvestmentWhere({ dateFrom: from, dateTo: to });
  const [grouped, sources, repayAgg] = await Promise.all([
    prisma.investment.groupBy({
      by: ['sourceId'],
      where,
      _sum: { amount: true },
    }),
    prisma.investmentSource.findMany({ select: { id: true, name: true } }),
    prisma.investment.aggregate({
      where: { ...where, reimbursable: true },
      _sum: { amount: true, amountRepaid: true },
    }),
  ]);

  const nameById = new Map(sources.map((s) => [s.id, s.name]));
  const bySource = grouped
    .map((g) => ({
      sourceId: g.sourceId,
      name: nameById.get(g.sourceId) ?? '—',
      amount: g._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = bySource.reduce((s, c) => s + c.amount, 0);
  const totalOutstanding = Math.max(
    0,
    (repayAgg._sum.amount ?? 0) - (repayAgg._sum.amountRepaid ?? 0)
  );

  return { total, totalOutstanding, bySource };
}
