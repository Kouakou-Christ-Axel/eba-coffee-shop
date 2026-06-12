import {
  Banknote,
  ClipboardList,
  Download,
  Landmark,
  PiggyBank,
  ShoppingBasket,
  TrendingDown,
  Wallet,
  XCircle,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth-helpers';
import { getRangeStats, getDailySeries, getTopProducts } from '@/lib/stats';
import { getExpenseSummary } from '@/lib/expenses';
import { getInvestmentSummary } from '@/lib/investments';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
} from '@/lib/timezone';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { RevenueTrendChart } from '@/components/(dashboard)/charts/revenue-trend-chart';
import { OrdersByTypeChart } from '@/components/(dashboard)/charts/orders-by-type-chart';
import { PaymentModeChart } from '@/components/(dashboard)/charts/payment-mode-chart';
import { StatusBreakdownChart } from '@/components/(dashboard)/charts/status-breakdown-chart';
import { TopProductsChart } from '@/components/(dashboard)/charts/top-products-chart';
import { ExpensesByCategoryChart } from '@/components/(dashboard)/charts/expenses-by-category-chart';
import { InvestmentsBySourceChart } from '@/components/(dashboard)/charts/investments-by-source-chart';

export const dynamic = 'force-dynamic';

const priceFormatter = new Intl.NumberFormat('fr-FR');
const DEFAULT_RANGE_DAYS = 30;

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));
  let fromStr = parseDateOnlyToUTC(params.from) ? params.from! : defaultFrom;
  let toStr = parseDateOnlyToUTC(params.to) ? params.to! : today;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const from = parseDateOnlyToUTC(fromStr)!;
  const to = parseDateOnlyToUTC(toStr)!;

  const [stats, series, topProducts, expenseSummary, investmentSummary] =
    await Promise.all([
      getRangeStats(from, to),
      getDailySeries(from, to),
      getTopProducts(from, to),
      getExpenseSummary(from, to),
      getInvestmentSummary(from, to),
    ]);

  // La marge nette d'exploitation reste CA − dépenses : les investissements
  // (apports/financements) sont du capital, suivis dans un bloc séparé.
  const netMargin = stats.revenue - expenseSummary.total;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-sm text-muted-foreground">
            Du {fromStr} au {toStr}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            from={fromStr}
            to={toStr}
            isAll={false}
            allowAll={false}
            presets={[
              { label: '7 jours', days: 7 },
              { label: '30 jours', days: 30 },
              { label: '90 jours', days: 90 },
            ]}
          />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/daily?from=${fromStr}&to=${toStr}`}>
              <Download className="mr-1.5 h-4 w-4" />
              Récap journalier
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/orders?from=${fromStr}&to=${toStr}`}>
              <Download className="mr-1.5 h-4 w-4" />
              Commandes
            </a>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label="CA encaissé"
          value={`${priceFormatter.format(stats.revenue)} F`}
          Icon={Banknote}
        />
        <Kpi
          label="Dépenses"
          value={`${priceFormatter.format(expenseSummary.total)} F`}
          Icon={Wallet}
        />
        <Kpi
          label="Marge nette"
          value={`${priceFormatter.format(netMargin)} F`}
          Icon={TrendingDown}
          valueClassName={netMargin < 0 ? 'text-destructive' : 'text-green-600'}
        />
        <Kpi
          label="Commandes"
          value={priceFormatter.format(stats.totalOrders)}
          Icon={ClipboardList}
        />
        <Kpi
          label="Panier moyen"
          value={`${priceFormatter.format(stats.avgBasket)} F`}
          Icon={ShoppingBasket}
        />
        <Kpi
          label="Taux d'annulation"
          value={`${Math.round(stats.cancellationRate * 100)} %`}
          Icon={XCircle}
        />
      </div>

      {/* Tendance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Chiffre d&apos;affaires & commandes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueTrendChart data={series} />
        </CardContent>
      </Card>

      {/* Répartitions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type de commande</CardTitle>
          </CardHeader>
          <CardContent>
            <OrdersByTypeChart counts={stats.countByOrderType} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CA par mode de paiement</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentModeChart revenueByMode={stats.revenueByPaymentMode} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commandes par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart counts={stats.countByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top produits</CardTitle>
          </CardHeader>
          <CardContent>
            <TopProductsChart data={topProducts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensesByCategoryChart data={expenseSummary.byCategory} />
          </CardContent>
        </Card>
      </div>

      {/* Investissements (apports/financements) — bloc séparé, n'entre pas dans
          la marge nette d'exploitation. */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Investissements</h2>
          <p className="text-sm text-muted-foreground">
            Apports et financements injectés sur la période. Hors marge nette
            d’exploitation.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            label="Total investi"
            value={`${priceFormatter.format(investmentSummary.total)} F`}
            Icon={PiggyBank}
          />
          <Kpi
            label="Restant dû"
            value={`${priceFormatter.format(investmentSummary.totalOutstanding)} F`}
            Icon={Landmark}
            valueClassName={
              investmentSummary.totalOutstanding > 0
                ? 'text-amber-600'
                : undefined
            }
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apports par source</CardTitle>
          </CardHeader>
          <CardContent>
            <InvestmentsBySourceChart data={investmentSummary.bySource} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  Icon: typeof Banknote;
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
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', valueClassName)}>
        {value}
      </p>
    </div>
  );
}
