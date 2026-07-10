import { Download, Layers, ReceiptText, Sigma, Wallet } from 'lucide-react';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import {
  listExpenses,
  listExpenseCategories,
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
import { ExpensesTable, type ExpenseRow } from './expenses-table';
import { CategoryFilter } from './category-filter';
import { ExpenseFilters } from './expense-filters';
import { RecurringAlert } from './recurring-alert';
import { ReceiptBackfillAlert } from './receipt-backfill-alert';

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
    recurringList,
    missingRecurring,
    unnumberedCount,
  ] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ dateFrom, dateTo, categoryId, paymentMethod, search }),
    listRecurringExpenses(),
    getMissingRecurringExpenses(),
    countUnnumberedExpenses(),
  ]);

  const recurringRows = recurringList.map((r) => ({
    id: r.id,
    label: r.label,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    expectedAmount: r.expectedAmount,
    active: r.active,
  }));
  const plainCategories = categories.map((c) => ({ id: c.id, name: c.name }));

  // Ventilation par catégorie (sur la sélection courante) : graphique + KPI.
  const byCategoryMap = new Map<string, number>();
  for (const e of expenses) {
    byCategoryMap.set(
      e.category.id,
      (byCategoryMap.get(e.category.id) ?? 0) + e.amount
    );
  }
  const byCategory = categories
    .map((c) => ({ name: c.name, amount: byCategoryMap.get(c.id) ?? 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const topCategory = byCategory[0];
  const avg = count > 0 ? Math.round(total / count) : 0;

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
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dépenses</h1>
        <p className="text-sm text-muted-foreground">
          Suivi des dépenses catégorisées du restaurant.
        </p>
      </div>

      <ReceiptBackfillAlert count={unnumberedCount} />

      <RecurringAlert missing={missingRecurring} categories={plainCategories} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Total période"
          value={`${priceFmt.format(total)} F`}
          Icon={Wallet}
        />
        <Kpi label="Nombre" value={priceFmt.format(count)} Icon={ReceiptText} />
        <Kpi label="Moyenne" value={`${priceFmt.format(avg)} F`} Icon={Sigma} />
        <Kpi
          label="Top catégorie"
          value={topCategory ? topCategory.name : '—'}
          hint={
            topCategory ? `${priceFmt.format(topCategory.amount)} F` : undefined
          }
          Icon={Layers}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Historique
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {isAll ? 'Tout l’historique' : `Du ${fromStr} au ${toStr}`}
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
            <DateRangeFilter from={fromStr} to={toStr} isAll={isAll} />
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
            recurring={recurringRows}
            total={total}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpensesByCategoryChart data={byCategory} />
        </CardContent>
      </Card>
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
