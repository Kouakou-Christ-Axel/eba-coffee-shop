import { Suspense } from 'react';
import { requireRoleOrAnalyst } from '@/lib/auth-helpers';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
} from '@/lib/timezone';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import {
  KpiGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
} from '@/components/(dashboard)/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { DepensesTabs } from './depenses-tabs';
import { ReceiptBackfillAlertSection } from './_components/receipt-backfill-alert-section';
import { RecurringAlertSection } from './_components/recurring-alert-section';
import { ApercuSection } from './_components/apercu-section';
import { HistoriqueSection } from './_components/historique-section';
import { ArticlesSection } from './_components/articles-section';
import { RecurrentesSection } from './_components/recurrentes-section';
import { ArticleHistorySection } from './_components/article-history-section';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;

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

      <Suspense fallback={null}>
        <ReceiptBackfillAlertSection />
      </Suspense>

      <Suspense fallback={null}>
        <RecurringAlertSection />
      </Suspense>

      <DepensesTabs
        defaultTab={params.tab}
        apercu={
          <Suspense
            fallback={
              <div className="space-y-4">
                <KpiGridSkeleton count={4} cols={4} />
                <ChartCardSkeleton height={280} />
                <ChartCardSkeleton height={280} />
              </div>
            }
          >
            <ApercuSection
              dateFrom={dateFrom}
              dateTo={dateTo}
              categoryId={categoryId}
              paymentMethod={paymentMethod}
              search={search}
            />
          </Suspense>
        }
        historique={
          <Suspense fallback={<TableSkeleton rows={10} />}>
            <HistoriqueSection
              dateFrom={dateFrom}
              dateTo={dateTo}
              categoryId={categoryId}
              paymentMethod={paymentMethod}
              search={search}
              periodLabel={periodLabel}
              exportHref={exportHref}
            />
          </Suspense>
        }
        articles={
          <Suspense fallback={<TableSkeleton rows={10} />}>
            <ArticlesSection
              dateFrom={dateFrom}
              dateTo={dateTo}
              categoryId={categoryId}
              paymentMethod={paymentMethod}
              search={search}
              periodLabel={periodLabel}
              exportItemsHref={exportItemsHref}
            />
          </Suspense>
        }
        recurrentes={
          <Suspense fallback={<TableSkeleton rows={6} withToolbar={false} />}>
            <RecurrentesSection />
          </Suspense>
        }
      />

      {params.article && (
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <ArticleHistorySection
            articleId={params.article}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </Suspense>
      )}
    </div>
  );
}
