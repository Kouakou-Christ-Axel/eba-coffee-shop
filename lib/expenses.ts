// lib/expenses.ts
//
// Lecture des dépenses et catégories (back-office). Les écritures vivent dans
// lib/expense-mutations.ts (miroir du couple lib/menu.ts / lib/menu-mutations.ts).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export interface ExpenseFilters {
  /** Plage de jours civils (Date à minuit UTC, inclusive). */
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
}

function buildExpenseWhere({
  dateFrom,
  dateTo,
  categoryId,
}: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }
  if (categoryId) where.categoryId = categoryId;
  return where;
}

/** Catégories triées, avec le nombre de dépenses rattachées. */
export async function listExpenseCategories() {
  return prisma.expenseCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { expenses: true } } },
  });
}

/** Liste des dépenses filtrées + total (somme des montants). */
export async function listExpenses(filters: ExpenseFilters = {}) {
  const where = buildExpenseWhere(filters);
  const [expenses, agg] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);
  return {
    expenses,
    total: agg._sum.amount ?? 0,
    count: agg._count,
  };
}

export type ExpenseSummary = {
  total: number;
  byCategory: { categoryId: string; name: string; amount: number }[];
};

/** Total des dépenses sur une plage + ventilation par catégorie (desc). */
export async function getExpenseSummary(
  from: Date,
  to: Date
): Promise<ExpenseSummary> {
  const where = buildExpenseWhere({ dateFrom: from, dateTo: to });
  const [grouped, categories] = await Promise.all([
    prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
    }),
    prisma.expenseCategory.findMany({ select: { id: true, name: true } }),
  ]);

  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = grouped
    .map((g) => ({
      categoryId: g.categoryId,
      name: nameById.get(g.categoryId) ?? '—',
      amount: g._sum.amount ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const total = byCategory.reduce((s, c) => s + c.amount, 0);
  return { total, byCategory };
}
