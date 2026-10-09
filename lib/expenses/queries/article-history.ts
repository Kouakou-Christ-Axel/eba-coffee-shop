import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';
import {
  monthKeyOf,
  countMonthsCovered,
  currentCivilMonthRange,
} from './months';
import {
  type ArticlePurchaseStat,
  aggregateArticlePurchases,
  resolveMonthsCovered,
} from './article-stats';

export type ExpenseArticleMonthlyPoint = {
  month: string; // YYYY-MM
  amount: number;
};

export async function getExpenseArticleMonthlySeries(filters: {
  from?: Date;
  to?: Date;
  categoryId?: string;
  paymentMethod?: Prisma.ExpenseWhereInput['paymentMethod'];
  search?: string;
}): Promise<ExpenseArticleMonthlyPoint[]> {
  const q = filters.search?.trim();
  const lines = await prisma.expenseItem.findMany({
    where: {
      articleId: { not: null },
      expense: {
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.paymentMethod
          ? { paymentMethod: filters.paymentMethod }
          : {}),
      },
      ...(q ? { article: { name: { contains: q, mode: 'insensitive' } } } : {}),
    },
    select: { amount: true, expense: { select: { date: true } } },
  });

  const byMonth = new Map<string, number>();
  for (const line of lines) {
    const key = monthKeyOf(line.expense.date);
    byMonth.set(key, (byMonth.get(key) ?? 0) + line.amount);
  }
  return [...byMonth.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getExpenseArticleHistory(
  articleId: string,
  filters: { from?: Date; to?: Date } = {}
) {
  const article = await prisma.expenseArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      inventoryItemId: true,
      wholesaleRefPrice: true,
      archivedAt: true,
    },
  });
  if (!article) return null;

  const lines = await prisma.expenseItem.findMany({
    where: {
      articleId,
      ...(filters.from || filters.to
        ? {
            expense: {
              date: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            },
          }
        : {}),
    },
    orderBy: [{ expense: { date: 'desc' } }, { createdAt: 'desc' }],
    select: {
      id: true,
      rawLabel: true,
      label: true,
      qtyBase: true,
      formatQty: true,
      formatSize: true,
      unit: true,
      unitPrice: true,
      amount: true,
      pendingQuantity: true,
      expense: {
        select: {
          id: true,
          date: true,
          receiptNo: true,
          supplier: true,
          paymentMethod: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  return {
    article,
    lines: lines.map((l) => ({
      id: l.id,
      rawLabel: l.rawLabel,
      label: l.label,
      qtyBase: l.qtyBase?.toNumber() ?? null,
      formatQty: l.formatQty?.toNumber() ?? null,
      formatSize: l.formatSize?.toNumber() ?? null,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
      pendingQuantity: l.pendingQuantity,
      expenseId: l.expense.id,
      date: formatLocalDateOnly(l.expense.date),
      receiptNo: l.expense.receiptNo,
      supplier: l.expense.supplier,
      paymentMethod: l.expense.paymentMethod,
      categoryName: l.expense.category.name,
    })),
  };
}

export async function getPurchaseFrequency(
  articleId?: string,
  period?: { from?: Date; to?: Date }
): Promise<ArticlePurchaseStat[]> {
  const { from, to } =
    period?.from || period?.to ? period! : currentCivilMonthRange();

  const lines = await prisma.expenseItem.findMany({
    where: {
      ...(articleId ? { articleId } : { articleId: { not: null } }),
      expense: {
        ...(from ? { date: { gte: from } } : {}),
        ...(to ? { date: { lte: to } } : {}),
      },
    },
    select: {
      amount: true,
      qtyBase: true,
      expense: { select: { id: true, date: true } },
      article: {
        select: { id: true, name: true, baseUnit: true, inventoryItemId: true },
      },
    },
  });

  const monthsCovered =
    from && to
      ? countMonthsCovered(from, to)
      : resolveMonthsCovered(from, to, lines);
  return aggregateArticlePurchases(lines, monthsCovered);
}
