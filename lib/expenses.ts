// lib/expenses.ts
//
// Lecture des dépenses, catégories et articles (back-office). Les écritures
// vivent dans lib/expense-mutations.ts (miroir du couple lib/menu.ts /
// lib/menu-mutations.ts).

import type { ExpenseNature } from '@/generated/prisma/client';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  todayDateString,
  parseDateOnlyToUTC,
  formatLocalDateOnly,
} from '@/lib/timezone';

export interface ExpenseFilters {
  /** Plage de jours civils (Date à minuit UTC, inclusive). */
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  /** Mode de paiement (CASH/WAVE/BANK/OTHER). */
  paymentMethod?: Prisma.ExpenseWhereInput['paymentMethod'];
  /** Recherche texte (fournisseur ou note, insensible à la casse). */
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
 * Total des dépenses sur une plage + ventilation par catégorie (desc) + split
 * fixes/variables (nature de la catégorie). Signature POSITIONNELLE
 * `(from, to)` préservée (consommateurs existants : `lib/mcp/tools.ts`,
 * `lib/stats-compare.ts`) ; `extra` (catégorie/paiement/recherche) est un
 * paramètre additionnel optionnel, jamais requis.
 */
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

export type ExpenseMonthlyPoint = {
  month: string; // YYYY-MM
  total: number;
  fixed: number;
  variable: number;
};

/** Mois civil 'YYYY-MM' d'une Date (Abidjan = UTC → composantes UTC). */
function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Liste des mois civils 'YYYY-MM' couverts (inclus) par une plage de Dates. */
function listMonthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1);
  while (cursor.getTime() <= end) {
    keys.push(monthKeyOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/** Nombre de mois civils couverts (inclusif) par une plage de Dates. */
function countMonthsCovered(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1
  );
}

/** Bornes (minuit UTC) du mois civil en cours à Abidjan. */
function currentCivilMonthRange(): { from: Date; to: Date } {
  const today = parseDateOnlyToUTC(todayDateString())!;
  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
  );
  return { from, to };
}

/**
 * Série mensuelle des dépenses, éclatée fixes/variables (nature de la
 * catégorie). Les mois sans dépense sont présents à zéro. `extra` applique
 * les mêmes filtres que `getExpenseSummary` (catégorie, paiement, recherche)
 * pour que les vues d'une même sélection restent cohérentes entre elles.
 */
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

// ─── Articles : référentiel + fréquence d'achat ───────────────────────────────

/** Articles actifs (autocomplétion / désambiguïsation), triés par nom. */
export async function listExpenseArticles(search?: string) {
  const q = search?.trim();
  return prisma.expenseArticle.findMany({
    where: {
      archivedAt: null,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      trackInventory: true,
      inventoryItemId: true,
      location: true,
      bulkPurchase: true,
      wholesaleRefPrice: true,
      _count: { select: { items: true } },
    },
  });
}

export type ArticlePurchaseStat = {
  articleId: string;
  name: string;
  baseUnit: string | null;
  inventoryItemId: string | null;
  /** Nombre d'achats = COMPTAGE des lignes (`ExpenseItem`) sur la période,
   * jamais un compteur stocké — recalculé à chaque appel. */
  purchaseCount: number;
  lineCount: number;
  totalAmount: number;
  /** Quantité cumulée en `baseUnit` — null si une ligne n'a pas de `qtyBase`. */
  totalQtyBase: number | null;
  /** Prix unitaire moyen pondéré (totalAmount / totalQtyBase), si calculable
   * (nécessite `baseUnit` homogène sur toutes les lignes, toujours vrai ici
   * puisque `qtyBase` est déjà normalisé dans l'unité de base de l'article). */
  avgUnitPrice: number | null;
  firstPurchaseDate: string | null; // YYYY-MM-DD
  lastPurchaseDate: string | null; // YYYY-MM-DD
  /** Intervalle moyen entre deux achats (jours) — null si < 2 achats. */
  avgIntervalDays: number | null;
  /** Cadence : achats / mois couverts par la plage (1 décimale). */
  monthlyAvgCount: number;
};

type ArticlePurchaseLine = {
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

/** Agrège des lignes d'achat par article — partagé par `getExpenseArticleStats`
 * et `getPurchaseFrequency` (même forme de données, filtres différents). */
function aggregateArticlePurchases(
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
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/** Nombre de mois couverts par les stats : plage explicite si fournie, sinon
 * l'étendue réelle des données (évite une cadence artificiellement écrasée). */
function resolveMonthsCovered(
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

/**
 * Fréquence d'achat par article sur une plage de jours civils (bornes
 * optionnelles = tout l'historique), en respectant les MÊMES filtres que la
 * liste des dépenses (`categoryId`, `paymentMethod`, `search` sur le nom
 * d'article) — pour que les stats reflètent la sélection affichée, pas
 * toujours l'historique entier. Tri : montant total desc.
 */
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

/**
 * Historique détaillé d'un article (drill-down « farine T45 ») : chaque ligne
 * d'achat avec sa dépense (reçu, date, fournisseur, paiement). Ordre desc.
 * Renvoie `null` si l'article n'existe pas.
 */
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

/**
 * Fréquence d'achat (jamais un compteur stocké — toujours un `COUNT` en
 * direct sur `ExpenseItem`) sur une période : mois civil Abidjan en cours par
 * défaut. `articleId` restreint à un seul article ; omis, calcule pour tous
 * les articles ayant au moins un achat sur la période.
 */
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
