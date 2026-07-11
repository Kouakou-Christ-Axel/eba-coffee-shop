// lib/expenses.ts
//
// Lecture des dépenses, catégories et articles (back-office). Les écritures
// vivent dans lib/expense-mutations.ts (miroir du couple lib/menu.ts /
// lib/menu-mutations.ts).

import type { ExpenseNature } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  formatLocalDateOnly,
  listMonthKeys,
  monthKeyFromDate,
} from '@/lib/timezone';

export interface ExpenseFilters {
  /** Plage de jours civils (Date à minuit UTC, inclusive). */
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  /** Mode de paiement (CASH/WAVE/BANK/OTHER). */
  paymentMethod?: Prisma.ExpenseWhereInput['paymentMethod'];
  /** Recherche texte (fournisseur, note, articles du détail — insensible). */
  search?: string;
}

function buildExpenseWhere({
  dateFrom,
  dateTo,
  categoryId,
  paymentMethod,
  search,
}: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }
  if (categoryId) where.categoryId = categoryId;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  const q = search?.trim();
  if (q) {
    where.OR = [
      { supplier: { contains: q, mode: 'insensitive' } },
      { note: { contains: q, mode: 'insensitive' } },
      // « farine » retrouve aussi les dépenses détaillées contenant une ligne
      // Farine T45 (nom d'article ou précision libre de la ligne).
      {
        items: {
          some: { article: { name: { contains: q, mode: 'insensitive' } } },
        },
      },
      { items: { some: { label: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  return where;
}

/** Nombre de dépenses sans numéro de reçu (toutes périodes confondues). */
export function countUnnumberedExpenses() {
  return prisma.expense.count({ where: { receiptNo: null } });
}

/** Catégories triées, avec le nombre de dépenses rattachées. */
export async function listExpenseCategories() {
  return prisma.expenseCategory.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { expenses: true } } },
  });
}

/** Liste des dépenses filtrées + total (somme des montants), détail inclus. */
export async function listExpenses(filters: ExpenseFilters = {}) {
  const where = buildExpenseWhere(filters);
  const [expenses, agg] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, nature: true } },
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { article: { select: { id: true, name: true } } },
        },
      },
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

/**
 * Total des dépenses filtrées + ventilation par catégorie (desc) et split
 * fixes/variables. Consommé par la page Dépenses, la page Statistiques et le
 * tool MCP `get_expense_summary` — source unique du calcul par catégorie.
 */
export async function getExpenseSummary(
  filters: ExpenseFilters = {}
): Promise<ExpenseSummary> {
  const where = buildExpenseWhere(filters);
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

// ─── Articles : référentiel + fréquence d'achat ───────────────────────────────

/** Articles actifs (autocomplétion / désambiguïsation), triés par nom. */
export async function listExpenseArticles(search?: string) {
  const q = search?.trim();
  return prisma.expenseArticle.findMany({
    where: {
      deletedAt: null,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      inventoryItemId: true,
      _count: { select: { items: true } },
    },
  });
}

export type ExpenseArticleStat = {
  articleId: string;
  name: string;
  inventoryItemId: string | null;
  /** Nombre d'achats = dépenses DISTINCTES contenant l'article. */
  purchaseCount: number;
  lineCount: number;
  totalAmount: number;
  /** Quantité cumulée — null si les lignes mélangent des unités (ou sans qté). */
  totalQuantity: number | null;
  unit: string | null;
  /** Prix unitaire moyen pondéré (totalAmount / totalQuantity), si calculable. */
  avgUnitPrice: number | null;
  firstPurchaseDate: string | null; // YYYY-MM-DD
  lastPurchaseDate: string | null; // YYYY-MM-DD
  /** Intervalle moyen entre deux achats (jours) — null si < 2 achats. */
  avgIntervalDays: number | null;
  /** Cadence : achats / mois couverts par la plage (1 décimale). */
  monthlyAvgCount: number;
};

/**
 * Fréquence d'achat par article sur une plage de jours civils (bornes
 * optionnelles = tout l'historique) : répond à « combien de fois a-t-on acheté
 * la farine T45 (ce mois-ci) ? ». `search` filtre par nom d'article (contains,
 * insensible). Tri : montant total desc.
 */
export async function getExpenseArticleStats(filters: {
  from?: Date;
  to?: Date;
  search?: string;
}): Promise<ExpenseArticleStat[]> {
  const q = filters.search?.trim();
  const lines = await prisma.expenseItem.findMany({
    where: {
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
      ...(q ? { article: { name: { contains: q, mode: 'insensitive' } } } : {}),
    },
    select: {
      amount: true,
      quantity: true,
      unit: true,
      expense: { select: { id: true, date: true } },
      article: { select: { id: true, name: true, inventoryItemId: true } },
    },
  });

  const byArticle = new Map<
    string,
    {
      article: { id: string; name: string; inventoryItemId: string | null };
      expenseIds: Set<string>;
      lineCount: number;
      totalAmount: number;
      totalQuantity: number | null;
      unit: string | null;
      unitConsistent: boolean;
      firstDate: Date | null;
      lastDate: Date | null;
    }
  >();

  for (const line of lines) {
    let acc = byArticle.get(line.article.id);
    if (!acc) {
      acc = {
        article: line.article,
        expenseIds: new Set(),
        lineCount: 0,
        totalAmount: 0,
        totalQuantity: 0,
        unit: null,
        unitConsistent: true,
        firstDate: null,
        lastDate: null,
      };
      byArticle.set(line.article.id, acc);
    }
    acc.expenseIds.add(line.expense.id);
    acc.lineCount++;
    acc.totalAmount += line.amount;

    // Quantité cumulée : uniquement si toutes les lignes ont une quantité et
    // partagent la même unité (comparaison insensible à la casse).
    const unit = line.unit?.trim().toLowerCase() ?? null;
    if (acc.unitConsistent) {
      if (line.quantity == null || unit === null) {
        acc.unitConsistent = false;
        acc.totalQuantity = null;
        acc.unit = null;
      } else if (acc.unit === null || acc.unit === unit) {
        acc.unit = unit;
        acc.totalQuantity = (acc.totalQuantity ?? 0) + line.quantity.toNumber();
      } else {
        acc.unitConsistent = false;
        acc.totalQuantity = null;
        acc.unit = null;
      }
    }

    if (!acc.firstDate || line.expense.date < acc.firstDate) {
      acc.firstDate = line.expense.date;
    }
    if (!acc.lastDate || line.expense.date > acc.lastDate) {
      acc.lastDate = line.expense.date;
    }
  }

  // Mois couverts (pour la cadence mensuelle) : plage explicite, sinon
  // l'étendue réelle des données.
  let monthCount = 1;
  if (filters.from && filters.to) {
    monthCount = listMonthKeys(filters.from, filters.to).length;
  } else {
    let min: Date | null = null;
    let max: Date | null = null;
    for (const acc of byArticle.values()) {
      if (acc.firstDate && (!min || acc.firstDate < min)) min = acc.firstDate;
      if (acc.lastDate && (!max || acc.lastDate > max)) max = acc.lastDate;
    }
    if (min && max) {
      monthCount = listMonthKeys(filters.from ?? min, filters.to ?? max).length;
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
      return {
        articleId: acc.article.id,
        name: acc.article.name,
        inventoryItemId: acc.article.inventoryItemId,
        purchaseCount,
        lineCount: acc.lineCount,
        totalAmount: acc.totalAmount,
        totalQuantity: acc.totalQuantity,
        unit: acc.unit,
        avgUnitPrice:
          acc.totalQuantity && acc.totalQuantity > 0
            ? Math.round(acc.totalAmount / acc.totalQuantity)
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
        monthlyAvgCount: Math.round((purchaseCount / monthCount) * 10) / 10,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Historique détaillé d'un article (drill-down « farine T45 ») : chaque ligne
 * d'achat avec sa dépense (reçu, date, fournisseur, paiement). Ordre desc.
 * Renvoie null si l'article n'existe pas.
 */
export async function getExpenseArticleHistory(
  articleId: string,
  from?: Date,
  to?: Date
) {
  const article = await prisma.expenseArticle.findUnique({
    where: { id: articleId },
    select: { id: true, name: true, inventoryItemId: true },
  });
  if (!article) return null;

  const lines = await prisma.expenseItem.findMany({
    where: {
      articleId,
      ...(from || to
        ? {
            expense: {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            },
          }
        : {}),
    },
    orderBy: [{ expense: { date: 'desc' } }, { createdAt: 'desc' }],
    select: {
      id: true,
      label: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      amount: true,
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
      label: l.label,
      quantity: l.quantity?.toNumber() ?? null,
      unit: l.unit,
      unitPrice: l.unitPrice,
      amount: l.amount,
      expenseId: l.expense.id,
      date: formatLocalDateOnly(l.expense.date),
      receiptNo: l.expense.receiptNo,
      supplier: l.expense.supplier,
      paymentMethod: l.expense.paymentMethod,
      categoryName: l.expense.category.name,
    })),
  };
}

export type ExpenseMonthlyPoint = {
  month: string; // YYYY-MM
  total: number;
  fixed: number;
  variable: number;
};

/**
 * Série mensuelle des dépenses, éclatée fixes/variables (nature de la
 * catégorie). Les mois sans dépense sont présents à zéro.
 */
export async function getExpenseMonthlySeries(
  from: Date,
  to: Date
): Promise<ExpenseMonthlyPoint[]> {
  const rows = await prisma.expense.findMany({
    where: { date: { gte: from, lte: to } },
    select: {
      date: true,
      amount: true,
      category: { select: { nature: true } },
    },
  });

  const byMonth = new Map<string, ExpenseMonthlyPoint>(
    listMonthKeys(from, to).map((month) => [
      month,
      { month, total: 0, fixed: 0, variable: 0 },
    ])
  );
  for (const row of rows) {
    const bucket = byMonth.get(monthKeyFromDate(row.date));
    if (!bucket) continue;
    bucket.total += row.amount;
    if (row.category.nature === 'FIXED') bucket.fixed += row.amount;
    else bucket.variable += row.amount;
  }
  return [...byMonth.values()];
}
