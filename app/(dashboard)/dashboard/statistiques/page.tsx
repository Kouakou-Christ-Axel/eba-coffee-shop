import {
  Banknote,
  ChefHat,
  ClipboardList,
  Download,
  Hourglass,
  Landmark,
  PiggyBank,
  ShoppingBasket,
  Stamp,
  Ticket,
  TrendingDown,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { requireStats } from '@/lib/auth-helpers';
import { getDailySeries, getTopProducts } from '@/lib/stats';
import { compareRanges } from '@/lib/stats-compare';
import {
  getHourlyDistribution,
  getKitchenPerformance,
} from '@/lib/stats-operations';
import { getCustomerRangeStats } from '@/lib/stats-customers';
import { getInvestmentSummary } from '@/lib/investments';
import { getRevenueAdjustmentSummary } from '@/lib/revenue-adjustments';
import {
  formatLocalDateOnly,
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
} from '@/lib/timezone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/(dashboard)/date-range-filter';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { RevenueTrendChart } from '@/components/(dashboard)/charts/revenue-trend-chart';
import { PeakHoursChart } from '@/components/(dashboard)/charts/peak-hours-chart';
import { KitchenTrendChart } from '@/components/(dashboard)/charts/kitchen-trend-chart';
import { OrdersByTypeChart } from '@/components/(dashboard)/charts/orders-by-type-chart';
import { PaymentModeChart } from '@/components/(dashboard)/charts/payment-mode-chart';
import { StatusBreakdownChart } from '@/components/(dashboard)/charts/status-breakdown-chart';
import { TopProductsChart } from '@/components/(dashboard)/charts/top-products-chart';
import { ExpensesByCategoryChart } from '@/components/(dashboard)/charts/expenses-by-category-chart';
import { InvestmentsBySourceChart } from '@/components/(dashboard)/charts/investments-by-source-chart';

export const dynamic = 'force-dynamic';

const priceFormatter = new Intl.NumberFormat('fr-FR');
const DEFAULT_RANGE_DAYS = 30;

/** Durée en secondes → « 4 min 30 s » (ou « — » si non mesurable). */
function formatDuration(sec: number | null): string {
  if (sec === null) return '—';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  if (minutes === 0) return `${seconds} s`;
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

export default async function StatistiquesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStats();
  const params = await searchParams;

  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));
  let fromStr = parseDateOnlyToUTC(params.from) ? params.from! : defaultFrom;
  let toStr = parseDateOnlyToUTC(params.to) ? params.to! : today;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const from = parseDateOnlyToUTC(fromStr)!;
  const to = parseDateOnlyToUTC(toStr)!;

  const [
    comparison,
    series,
    topProducts,
    hourly,
    kitchen,
    customerStats,
    investmentSummary,
    adjustmentSummary,
  ] = await Promise.all([
    compareRanges(from, to),
    getDailySeries(from, to),
    getTopProducts(from, to),
    getHourlyDistribution(from, to),
    getKitchenPerformance(from, to),
    getCustomerRangeStats(from, to),
    getInvestmentSummary(from, to),
    getRevenueAdjustmentSummary(from, to),
  ]);

  const stats = comparison.current;
  const { deltas } = comparison;
  // La marge nette d'exploitation reste CA − dépenses : les investissements
  // (apports/financements) sont du capital, suivis dans un bloc séparé. Le CA
  // (stats.revenue) inclut déjà les régularisations de recette.
  const netMargin = stats.revenue - comparison.expenses.current.total;
  const rangeDays =
    Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const vsLabel =
    rangeDays === 1
      ? 'vs veille'
      : `vs ${priceFormatter.format(rangeDays)} j précédents`;
  const kitchenByDay = kitchen.byDay.map((d) => ({
    date: d.date,
    avgPrepMin:
      d.avgPrepSec !== null ? Math.round(d.avgPrepSec / 60) : null,
    measured: d.measured,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-sm text-muted-foreground">
            Du {fromStr} au {toStr} · comparé du{' '}
            {formatLocalDateOnly(comparison.previousFrom)} au{' '}
            {formatLocalDateOnly(comparison.previousTo)}
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
        <KpiCard
          label="CA encaissé"
          value={`${priceFormatter.format(stats.revenue)} F`}
          Icon={Banknote}
          delta={{ pct: deltas.revenue.pct, label: vsLabel }}
          hint={
            adjustmentSummary.total !== 0
              ? `dont régularisations : ${adjustmentSummary.total < 0 ? '−' : '+'}${priceFormatter.format(Math.abs(adjustmentSummary.total))} F`
              : undefined
          }
        />
        <KpiCard
          label="Dépenses"
          value={`${priceFormatter.format(comparison.expenses.current.total)} F`}
          Icon={Wallet}
          delta={{ pct: deltas.expenses.pct, label: vsLabel, goodWhenUp: false }}
        />
        <KpiCard
          label="Marge nette"
          value={`${priceFormatter.format(netMargin)} F`}
          Icon={TrendingDown}
          valueClassName={netMargin < 0 ? 'text-destructive' : 'text-green-600'}
          delta={{ pct: deltas.netMargin.pct, label: vsLabel }}
        />
        <KpiCard
          label="Commandes"
          value={priceFormatter.format(stats.totalOrders)}
          Icon={ClipboardList}
          delta={{ pct: deltas.totalOrders.pct, label: vsLabel }}
        />
        <KpiCard
          label="Panier moyen"
          value={`${priceFormatter.format(stats.avgBasket)} F`}
          Icon={ShoppingBasket}
          delta={{ pct: deltas.avgBasket.pct, label: vsLabel }}
        />
        <KpiCard
          label="Taux d'annulation"
          value={`${Math.round(stats.cancellationRate * 100)} %`}
          Icon={XCircle}
          delta={{
            pct:
              comparison.previous.totalOrders > 0
                ? deltas.cancellationRatePts.diffPts
                : null,
            label: vsLabel,
            goodWhenUp: false,
            unit: 'pts',
          }}
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

      {/* Heures de pointe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heures de pointe</CardTitle>
          <p className="text-sm text-muted-foreground">
            Affluence et CA encaissé par heure de la journée, cumulés sur la
            période. Hors régularisations (sans heure).
          </p>
        </CardHeader>
        <CardContent>
          <PeakHoursChart data={hourly} />
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
            <ExpensesByCategoryChart
              data={comparison.expenses.current.byCategory}
            />
          </CardContent>
        </Card>
      </div>

      {/* Performance cuisine */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Performance cuisine</h2>
          <p className="text-sm text-muted-foreground">
            Temps mesurés sur les commandes passées en préparation (hors
            annulées).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard
            label="Préparation moyenne"
            value={formatDuration(kitchen.prep.avgSec)}
            Icon={ChefHat}
            hint={`sur ${priceFormatter.format(kitchen.prep.measured)} commande${kitchen.prep.measured > 1 ? 's' : ''} mesurée${kitchen.prep.measured > 1 ? 's' : ''}`}
          />
          <KpiCard
            label="Préparation médiane"
            value={formatDuration(kitchen.prep.medianSec)}
            Icon={ChefHat}
            subtle
          />
          <KpiCard
            label="Attente avant préparation"
            value={formatDuration(kitchen.wait.avgSec)}
            Icon={Hourglass}
            hint={`sur ${priceFormatter.format(kitchen.wait.measured)} commande${kitchen.wait.measured > 1 ? 's' : ''} mesurée${kitchen.wait.measured > 1 ? 's' : ''}`}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Temps de préparation — tendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <KitchenTrendChart data={kitchenByDay} />
          </CardContent>
        </Card>
      </div>

      {/* Clients & fidélité */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Clients & fidélité</h2>
          <p className="text-sm text-muted-foreground">
            Activité des clients identifiés (
            {Math.round(customerStats.identificationRate * 100)} % des
            commandes de la période) et mouvements de la carte de fidélité.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Nouveaux clients"
            value={priceFormatter.format(customerStats.newCustomers)}
            Icon={UserPlus}
          />
          <KpiCard
            label="Clients actifs"
            value={priceFormatter.format(customerStats.activeCustomers)}
            Icon={Users}
          />
          <KpiCard
            label="Clients récurrents"
            value={priceFormatter.format(customerStats.returningCustomers)}
            Icon={UserCheck}
            hint="≥ 2 commandes sur la période"
          />
          <KpiCard
            label="Tampons gagnés"
            value={priceFormatter.format(customerStats.loyalty.stampsEarned)}
            Icon={Stamp}
            subtle
          />
          <KpiCard
            label="Récompenses utilisées"
            value={priceFormatter.format(customerStats.loyalty.rewardsUsed)}
            Icon={Ticket}
            subtle
            hint={`${priceFormatter.format(customerStats.loyalty.rewardsEarned)} débloquée${customerStats.loyalty.rewardsEarned > 1 ? 's' : ''}`}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top clients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customerStats.topCustomers.length > 0 ? (
              customerStats.topCustomers.map((c) => (
                <div
                  key={c.customerId}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {c.name ?? c.phone}
                  </span>
                  <span className="flex items-baseline gap-3 text-sm">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {priceFormatter.format(c.orders)} commande
                      {c.orders > 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {priceFormatter.format(c.revenue)} F
                    </span>
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun client identifié sur la période.
              </p>
            )}
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
          <KpiCard
            label="Total investi"
            value={`${priceFormatter.format(investmentSummary.total)} F`}
            Icon={PiggyBank}
          />
          <KpiCard
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
