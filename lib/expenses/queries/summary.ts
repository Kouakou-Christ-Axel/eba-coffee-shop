import type { ExpenseNature } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { type ExpenseFilters, buildExpenseWhere } from './filters';

export type ExpenseSummary = {
  total: number;
  /** Sous-totaux par nature de catégorie (fixed + variable == total). */
  fixed: number;
  variable: number;
  byCategory: {
    categoryId: string;
    name: string;
    nature: ExpenseNature;
    amount: number;
    count: number;
  }[];
};

export async function getExpenseSummary(
  from: Date,
  to: Date,
  extra: Omit<ExpenseFilters, 'dateFrom' | 'dateTo'> = {}
): Promise<ExpenseSummary> {
  const where = buildExpenseWhere({ ...extra, dateFrom: from, dateTo: to });
  const [grouped, categories] = await Promise.all([
    prisma.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expenseCategory.findMany({
      select: { id: true, name: true, nature: true },
    }),
  ]);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const byCategory = grouped
    .map((g) => {
      const cat = catById.get(g.categoryId);
      return {
        categoryId: g.categoryId,
        name: cat?.name ?? '—',
        nature: (cat?.nature ?? 'VARIABLE') as ExpenseNature,
        amount: g._sum.amount ?? 0,
        count: g._count,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = byCategory.reduce((s, c) => s + c.amount, 0);
  const fixed = byCategory
    .filter((c) => c.nature === 'FIXED')
    .reduce((s, c) => s + c.amount, 0);
  return { total, fixed, variable: total - fixed, byCategory };
}
