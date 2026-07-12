import {
  Download,
  Landmark,
  ReceiptText,
  ShoppingBasket,
  Wallet,
} from 'lucide-react';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import {
  listExpenses,
  listExpenseCategories,
  listExpenseArticles,
  getExpenseSummary,
  getExpenseArticleStats,
  getExpenseArticleHistory,
  getExpenseMonthlySeries,
  countUnnumberedExpenses,
} from '@/lib/expenses';
import {
  listRecurringExpenses,
  getMissingRecurringExpenses,
} from '@/lib/recurring-expenses';
import prisma from '@/lib/prisma';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { ExpensesByCategoryChart } from '@/components/(dashboard)/charts/expenses-by-category-chart';
import { ExpenseTrendChart } from '@/components/(dashboard)/charts/expense-trend-chart';
import { ExpensesTable, type ExpenseRow } from './expenses-table';
import { CategoryFilter } from './category-filter';
import { ExpenseFilters } from './expense-filters';
import { RecurringAlert } from './recurring-alert';
import { ReceiptBackfillAlert } from './receipt-backfill-alert';
import { DepensesTabs } from './depenses-tabs';
import { ArticlesTable } from './articles-table';
import { ArticleHistorySheet } from './article-history-sheet';
import { RecurringManager } from './recurring-manager';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;
const priceFmt = new Intl.NumberFormat('fr-FR');

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  BANK: 'Banque',
  OTHER: 'Autre',
};

const PAYMENT_METHODS = ['CASH', 'WAVE', 'BANK', 'OTHER'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    range?: string;
    category?: string;
    payment?: string;
    search?: string;
    tab?: string;
    article?: string;
  }>;
}) {
  await requireRoleOrAnalyst(['ADMIN']);
  const params = await searchParams;

  const isAll = params.range === 'all';
  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));
  let fromStr = '';
  let toStr = '';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(params.from) ? params.from! : defaultFrom;
    toStr = parseDateOnlyToUTC(params.to) ? params.to! : today;
    if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }

  const categoryId = params.category || undefined;
  const paymentMethod = PAYMENT_METHODS.includes(
    params.payment as PaymentMethod
  )
    ? (params.payment as PaymentMethod)
    : undefined;
  const search = params.search?.trim() || undefined;

  const [
    categories,
    { expenses, total, count },
    articlesFull,
    allTimeArticleStats,
    articleStats,
    articleHistory,
    recurringList,
    missingRecurring,
    unnumberedCount,
  ] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ dateFrom, dateTo, categoryId, paymentMethod, search }),
    listExpenseArticles(),
    // Non filtré (tout l'historique) : sert de repère de prix pour
    // l'autocomplétion du formulaire, utile même hors période affichée.
    getExpenseArticleStats({}),
    getExpenseArticleStats({
      from: dateFrom,
      to: dateTo,
      categoryId,
      paymentMethod,
      search,
    }),
    params.article
      ? getExpenseArticleHistory(params.article, { from: dateFrom, to: dateTo })
      : Promise.resolve(null),
    listRecurringExpenses(),
    getMissingRecurringExpenses(),
    countUnnumberedExpenses(),
  ]);

  // getExpenseSummary/getExpenseMonthlySeries exigent des bornes concrètes :
  // en mode « tout l'historique », on retient l'étendue réelle de la
  // sélection (première dépense) plutôt qu'une borne arbitraire, pour ne pas
  // fausser les cadences moyennes.
  const effectiveFrom =
    dateFrom ??
    (expenses.length > 0
      ? expenses[expenses.length - 1].date
      : parseDateOnlyToUTC(today)!);
  const effectiveTo = dateTo ?? parseDateOnlyToUTC(today)!;

  const [summary, monthlySeries] = await Promise.all([
    getExpenseSummary(effectiveFrom, effectiveTo, {
      categoryId,
      paymentMethod,
      search,
    }),
    getExpenseMonthlySeries(effectiveFrom, effectiveTo, {
      categoryId,
      paymentMethod,
      search,
    }),
  ]);

  // Détail par article (ExpenseItem) des dépenses de la sélection :
  // lib/expenses.ts::listExpenses reste volontairement sans `items` (hors
  // périmètre de ce step) — on les charge ici directement, comme le fait déjà
  // l'export CSV (app/api/export/expense-items/route.ts) ; simple eager-load
  // en lecture, aucune logique métier dupliquée.
  const expenseIds = expenses.map((e) => e.id);
  const items =
    expenseIds.length > 0
      ? await prisma.expenseItem.findMany({
          where: { expenseId: { in: expenseIds } },
          orderBy: { sortOrder: 'asc' },
          include: { article: { select: { id: true, name: true } } },
        })
      : [];
  const itemsByExpense = new Map<string, typeof items>();
  for (const it of items) {
    const arr = itemsByExpense.get(it.expenseId) ?? [];
    arr.push(it);
    itemsByExpense.set(it.expenseId, arr);
  }

  const recurringRows = recurringList.map((r) => ({
    id: r.id,
    label: r.label,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    expectedAmount: r.expectedAmount,
    active: r.active,
  }));
  const plainCategories = categories.map((c) => ({ id: c.id, name: c.name }));

  // Référentiel d'articles pour l'autocomplétion du formulaire de saisie :
  // fusionne le référentiel (nom, unité, suivi de stock) avec le prix moyen
  // pondéré connu (repère indicatif, pas garanti être EXACTEMENT le dernier
  // achat) issu des stats non filtrées.
  const priceByArticle = new Map(
    allTimeArticleStats.map((s) => [s.articleId, s.avgUnitPrice])
  );
  const articleOptions = articlesFull.map((a) => ({
    id: a.id,
    name: a.name,
    baseUnit: a.baseUnit,
    trackInventory: a.trackInventory,
    lastUnitPrice: priceByArticle.get(a.id) ?? null,
  }));
  const articlesMeta = articlesFull.map((a) => ({
    id: a.id,
    name: a.name,
    baseUnit: a.baseUnit,
    trackInventory: a.trackInventory,
    location: a.location,
    wholesaleRefPrice: a.wholesaleRefPrice,
    itemsCount: a._count.items,
  }));

  const exportSp = new URLSearchParams();
  if (isAll) exportSp.set('range', 'all');
  else {
    exportSp.set('from', fromStr);
    exportSp.set('to', toStr);
  }
  if (categoryId) exportSp.set('category', categoryId);
  if (paymentMethod) exportSp.set('payment', paymentMethod);
  if (search) exportSp.set('search', search);
  const exportHref = `/api/export/expenses?${exportSp.toString()}`;

  const exportItemsSp = new URLSearchParams();
  if (isAll) exportItemsSp.set('range', 'all');
  else {
    exportItemsSp.set('from', fromStr);
    exportItemsSp.set('to', toStr);
  }
  const exportItemsHref = `/api/export/expense-items?${exportItemsSp.toString()}`;

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    receiptNo: e.receiptNo,
    date: formatLocalDateOnly(e.date),
    amount: e.amount,
    paymentLabel: PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
    paymentMethod: e.paymentMethod,
    supplier: e.supplier,
    note: e.note,
    receiptUrl: e.receiptUrl,
    categoryId: e.category.id,
    categoryName: e.category.name,
    items: (itemsByExpense.get(e.id) ?? []).map((i) => ({
      id: i.id,
      articleId: i.articleId,
      articleName: i.article?.name ?? null,
      rawLabel: i.rawLabel,
      label: i.label,
      formatQty: i.formatQty?.toNumber() ?? null,
      formatSize: i.formatSize?.toNumber() ?? null,
      unit: i.unit,
      unitPrice: i.unitPrice,
      amount: i.amount,
      pendingQuantity: i.pendingQuantity,
    })),
  }));

  const periodLabel = isAll ? 'Tout l’historique' : `Du ${fromStr} au ${toStr}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dépenses</h1>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <DateRangeFilter from={fromStr} to={toStr} isAll={isAll} />
      </div>

      <ReceiptBackfillAlert count={unnumberedCount} />

      <RecurringAlert missing={missingRecurring} categories={plainCategories} />

      <DepensesTabs
        defaultTab={params.tab}
        apercu={
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                label="Total période"
                value={`${priceFmt.format(summary.total)} F`}
                Icon={Wallet}
              />
              <KpiCard
                label="Fixes"
                value={`${priceFmt.format(summary.fixed)} F`}
                Icon={Landmark}
                hint="loyer, salaires, abonnements…"
              />
              <KpiCard
                label="Variables"
                value={`${priceFmt.format(summary.variable)} F`}
                Icon={ShoppingBasket}
                hint="achats, matières premières…"
              />
              <KpiCard
                label="Nombre"
                value={priceFmt.format(count)}
                Icon={ReceiptText}
                hint={
                  count > 0
                    ? `moyenne : ${priceFmt.format(Math.round(total / count))} F`
                    : undefined
                }
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Dépenses par mois — fixes vs variables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpenseTrendChart data={monthlySeries} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Dépenses par catégorie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpensesByCategoryChart data={summary.byCategory} />
              </CardContent>
            </Card>
          </>
        }
        historique={
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Historique
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {periodLabel}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryFilter
                  categories={categories}
                  selected={categoryId ?? ''}
                />
                <ExpenseFilters
                  payment={paymentMethod ?? ''}
                  search={search ?? ''}
                />
                <Button asChild variant="outline" size="sm">
                  <a href={exportHref}>
                    <Download className="mr-1.5 h-4 w-4" />
                    Exporter CSV
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ExpensesTable
                expenses={rows}
                categories={categories}
                articles={articleOptions}
                total={total}
              />
            </CardContent>
          </Card>
        }
        articles={
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                Fréquence d’achat par article
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {periodLabel}
                </span>
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <a href={exportItemsHref}>
                  <Download className="mr-1.5 h-4 w-4" />
                  Exporter le détail CSV
                </a>
              </Button>
            </CardHeader>
            <CardContent>
              <ArticlesTable stats={articleStats} articlesMeta={articlesMeta} />
            </CardContent>
          </Card>
        }
        recurrentes={
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Dépenses récurrentes (aide-mémoire)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RecurringManager
                recurring={recurringRows}
                categories={plainCategories}
              />
            </CardContent>
          </Card>
        }
      />

      {articleHistory && (
        <ArticleHistorySheet
          articleId={articleHistory.article.id}
          articleName={articleHistory.article.name}
          lines={articleHistory.lines}
          articlesMeta={articlesMeta}
        />
      )}
    </div>
  );
}
