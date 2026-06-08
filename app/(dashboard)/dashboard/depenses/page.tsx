import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth-helpers';
import { listExpenses, listExpenseCategories } from '@/lib/expenses';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { ExpenseForm } from './expense-form';
import { CategoryManager } from './category-manager';
import { ExpensesTable, type ExpenseRow } from './expenses-table';
import { CategoryFilter } from './category-filter';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  BANK: 'Banque',
  OTHER: 'Autre',
};

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    range?: string;
    category?: string;
  }>;
}) {
  await requireAdmin();
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

  const [categories, { expenses, total }] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ dateFrom, dateTo, categoryId }),
  ]);

  const exportSp = new URLSearchParams();
  if (isAll) exportSp.set('range', 'all');
  else {
    exportSp.set('from', fromStr);
    exportSp.set('to', toStr);
  }
  if (categoryId) exportSp.set('category', categoryId);
  const exportHref = `/api/export/expenses?${exportSp.toString()}`;

  const rows: ExpenseRow[] = expenses.map((e) => ({
    id: e.id,
    date: formatLocalDateOnly(e.date),
    amount: e.amount,
    paymentLabel: PAYMENT_LABELS[e.paymentMethod] ?? e.paymentMethod,
    supplier: e.supplier,
    note: e.note,
    receiptUrl: e.receiptUrl,
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nouvelle dépense</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catégories</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager categories={categories} />
        </CardContent>
      </Card>

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
          <ExpensesTable expenses={rows} total={total} />
        </CardContent>
      </Card>
    </div>
  );
}
