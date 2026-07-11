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
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
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
  const filters = { dateFrom, dateTo, categoryId, paymentMethod, search };

  const [
    categories,
    { expenses, total, count },
    summary,
    articleStats,
    articles,
    articleHistory,
    recurringList,
    missingRecurring,
    unnumberedCount,
  ] = await Promise.all([
    listExpenseCategories(),
    listExpenses(filters),
    getExpenseSummary(filters),
    getExpenseArticleStats({ from: dateFrom, to: dateTo }),
    listExpenseArticles(),
    params.article
      ? getExpenseArticleHistory(params.article, dateFrom, dateTo)
      : Promise.resolve(null),
    listRecurringExpenses(),
    getMissingRecurringExpenses(),
    countUnnumberedExpenses(),
  ]);

  // Série mensuelle : plage explicite, ou étendue réelle en mode « tout ».
  const monthlyFrom =
    dateFrom ??
    (expenses.length > 0 ? expenses[expenses.length - 1].date : null);
  const monthlyTo = dateTo ?? parseDateOnlyToUTC(today)!;
  const monthlySeries = monthlyFrom
    ? await getExpenseMonthlySeries(monthlyFrom, monthlyTo)
    : [];

  const recurringRows = recurringList.map((r) => ({
    id: r.id,
    label: r.label,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    expectedAmount: r.expectedAmount,
    active: r.active,
  }));
  const plainCategories = categories.map((c) => ({ id: c.id, name: c.name }));
  const plainArticles = articles.map((a) => ({ id: a.id, name: a.name }));

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
    items: e.items.map((i) => ({
      articleName: i.article.name,
      label: i.label,
      quantity: i.quantity?.toNumber() ?? null,
      unit: i.unit,
      unitPrice: i.unitPrice,
      amount: i.amount,
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
              <Kpi
                label="Total période"
                value={`${priceFmt.format(summary.total)} F`}
                Icon={Wallet}
              />
              <Kpi
                label="Fixes"
                value={`${priceFmt.format(summary.fixed)} F`}
                Icon={Landmark}
                hint="loyer, salaires, abonnements…"
              />
              <Kpi
                label="Variables"
                value={`${priceFmt.format(summary.variable)} F`}
                Icon={ShoppingBasket}
                hint="achats, matières premières…"
              />
              <Kpi
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
                articles={plainArticles}
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
              <ArticlesTable stats={articleStats} />
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
          articleName={articleHistory.article.name}
          lines={articleHistory.lines}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Wallet;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p
        className={cn(
          'mt-2 truncate text-2xl font-bold tabular-nums',
          valueClassName
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}
