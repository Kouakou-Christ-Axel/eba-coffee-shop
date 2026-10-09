import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';
import { countMonthsCovered } from './months';

export type ArticlePurchaseStat = {
  articleId: string;
  name: string;
  baseUnit: string | null;
  inventoryItemId: string | null;
  purchaseCount: number;
  lineCount: number;
  missingQtyLineCount: number;
  totalAmount: number;
  /** Quantité cumulée en `baseUnit` — null si une ligne n'a pas de `qtyBase`. */
  totalQtyBase: number | null;
  avgUnitPrice: number | null;
  firstPurchaseDate: string | null; // YYYY-MM-DD
  lastPurchaseDate: string | null; // YYYY-MM-DD
  /** Intervalle moyen entre deux achats (jours) — null si < 2 achats. */
  avgIntervalDays: number | null;
  /** Cadence : achats / mois couverts par la plage (1 décimale). */
  monthlyAvgCount: number;
  monthlyAvgQtyBase: number | null;
};

export type ArticlePurchaseLine = {
  amount: number;
  qtyBase: Prisma.Decimal | null;
  expense: { id: string; date: Date };
  article: {
    id: string;
    name: string;
    baseUnit: string | null;
    inventoryItemId: string | null;
  } | null;
};

export function aggregateArticlePurchases(
  lines: ArticlePurchaseLine[],
  monthsCovered: number
): ArticlePurchaseStat[] {
  const byArticle = new Map<
    string,
    {
      article: {
        id: string;
        name: string;
        baseUnit: string | null;
        inventoryItemId: string | null;
      };
      expenseIds: Set<string>;
      lineCount: number;
      missingQtyLineCount: number;
      totalAmount: number;
      totalQtyBase: number;
      hasMissingQty: boolean;
      firstDate: Date | null;
      lastDate: Date | null;
    }
  >();

  for (const line of lines) {
    if (!line.article) continue;
    let acc = byArticle.get(line.article.id);
    if (!acc) {
      acc = {
        article: line.article,
        expenseIds: new Set(),
        lineCount: 0,
        missingQtyLineCount: 0,
        totalAmount: 0,
        totalQtyBase: 0,
        hasMissingQty: false,
        firstDate: null,
        lastDate: null,
      };
      byArticle.set(line.article.id, acc);
    }
    acc.expenseIds.add(line.expense.id);
    acc.lineCount++;
    acc.totalAmount += line.amount;
    if (line.qtyBase == null) {
      acc.hasMissingQty = true;
      acc.missingQtyLineCount++;
    } else if (!acc.hasMissingQty) {
      acc.totalQtyBase += line.qtyBase.toNumber();
    }
    if (!acc.firstDate || line.expense.date < acc.firstDate) {
      acc.firstDate = line.expense.date;
    }
    if (!acc.lastDate || line.expense.date > acc.lastDate) {
      acc.lastDate = line.expense.date;
    }
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  return [...byArticle.values()]
    .map((acc) => {
      const purchaseCount = acc.expenseIds.size;
      const spanDays =
        acc.firstDate && acc.lastDate
          ? Math.round(
              (acc.lastDate.getTime() - acc.firstDate.getTime()) / DAY_MS
            )
          : 0;
      const totalQtyBase = acc.hasMissingQty ? null : acc.totalQtyBase;
      return {
        articleId: acc.article.id,
        name: acc.article.name,
        baseUnit: acc.article.baseUnit,
        inventoryItemId: acc.article.inventoryItemId,
        purchaseCount,
        lineCount: acc.lineCount,
        missingQtyLineCount: acc.missingQtyLineCount,
        totalAmount: acc.totalAmount,
        totalQtyBase,
        avgUnitPrice:
          totalQtyBase && totalQtyBase > 0
            ? Math.round(acc.totalAmount / totalQtyBase)
            : null,
        firstPurchaseDate: acc.firstDate
          ? formatLocalDateOnly(acc.firstDate)
          : null,
        lastPurchaseDate: acc.lastDate
          ? formatLocalDateOnly(acc.lastDate)
          : null,
        avgIntervalDays:
          purchaseCount >= 2
            ? Math.round((spanDays / (purchaseCount - 1)) * 10) / 10
            : null,
        monthlyAvgCount:
          Math.round((purchaseCount / Math.max(monthsCovered, 1)) * 10) / 10,
        monthlyAvgQtyBase:
          totalQtyBase != null
            ? Math.round((totalQtyBase / Math.max(monthsCovered, 1)) * 1000) /
              1000
            : null,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function resolveMonthsCovered(
  from: Date | undefined,
  to: Date | undefined,
  lines: { expense: { date: Date } }[]
): number {
  if (from && to) return countMonthsCovered(from, to);
  let min: Date | null = null;
  let max: Date | null = null;
  for (const line of lines) {
    if (!min || line.expense.date < min) min = line.expense.date;
    if (!max || line.expense.date > max) max = line.expense.date;
  }
  if (!min || !max) return 1;
  return countMonthsCovered(from ?? min, to ?? max);
}

export type ExpenseArticleStat = ArticlePurchaseStat;

export async function getExpenseArticleStats(filters: {
  from?: Date;
  to?: Date;
  categoryId?: string;
  paymentMethod?: Prisma.ExpenseWhereInput['paymentMethod'];
  search?: string;
}): Promise<ExpenseArticleStat[]> {
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
    select: {
      amount: true,
      qtyBase: true,
      expense: { select: { id: true, date: true } },
      article: {
        select: { id: true, name: true, baseUnit: true, inventoryItemId: true },
      },
    },
  });

  const monthsCovered = resolveMonthsCovered(filters.from, filters.to, lines);
  return aggregateArticlePurchases(lines, monthsCovered);
}
