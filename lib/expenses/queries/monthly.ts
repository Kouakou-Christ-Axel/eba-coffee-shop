import prisma from '@/lib/prisma';
import { type ExpenseFilters, buildExpenseWhere } from './filters';
import { monthKeyOf, listMonthKeysBetween } from './months';

export type ExpenseMonthlyPoint = {
  month: string; // YYYY-MM
  total: number;
  fixed: number;
  variable: number;
};

/** Série mensuelle des dépenses, éclatée fixes/variables (nature de la catégorie). */
export async function getExpenseMonthlySeries(
  from: Date,
  to: Date,
  extra: Omit<ExpenseFilters, 'dateFrom' | 'dateTo'> = {}
): Promise<ExpenseMonthlyPoint[]> {
  const rows = await prisma.expense.findMany({
    where: buildExpenseWhere({ ...extra, dateFrom: from, dateTo: to }),
    select: {
      date: true,
      amount: true,
      category: { select: { nature: true } },
    },
  });

  const byMonth = new Map<string, ExpenseMonthlyPoint>(
    listMonthKeysBetween(from, to).map((month) => [
      month,
      { month, total: 0, fixed: 0, variable: 0 },
    ])
  );
  for (const row of rows) {
    const bucket = byMonth.get(monthKeyOf(row.date));
    if (!bucket) continue;
    bucket.total += row.amount;
    if (row.category.nature === 'FIXED') bucket.fixed += row.amount;
    else bucket.variable += row.amount;
  }
  return [...byMonth.values()];
}
