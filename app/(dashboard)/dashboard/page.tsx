import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Banknote,
  BarChart3,
  Bike,
  Boxes,
  ChefHat,
  CheckCheck,
  Clock,
  Coffee,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { requireDashboardAccess } from '@/lib/auth-helpers';
import { getDailySeries } from '@/lib/stats';
import { compareDays, type Delta } from '@/lib/stats-compare';
import { listLowStockItems } from '@/lib/inventory';
import { maybeSendInventoryReminder } from '@/lib/inventory-mutations';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { RevenueTrendChart } from '@/components/(dashboard)/charts/revenue-trend-chart';
import { OrdersByTypeChart } from '@/components/(dashboard)/charts/orders-by-type-chart';

const priceFormatter = new Intl.NumberFormat('fr-FR');
const stockFormatter = new Intl.NumberFormat('fr-FR');

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireDashboardAccess();
  const role = session.user.role;

  if (role === 'CASHIER') redirect('/dashboard/caisse');
  if (role === 'KITCHEN') redirect('/dashboard/preparation');

  // Rappel d'inventaire (idempotent, fire-and-forget, ne lève jamais).
  void maybeSendInventoryReminder().catch(() => {});

  // Comparaison jour courant (partiel) vs hier / même jour semaine dernière
  // (complets) : le delta est structurellement pessimiste en cours de journée,
  // le label « vs hier » assume ce biais.
  const [comparison, lowStock] = await Promise.all([
    compareDays(),
    listLowStockItems(),
  ]);
  const stats = comparison.today;

  // Tendance des 7 derniers jours (jour courant inclus).
  const seriesFrom = new Date(stats.date.getTime());
  seriesFrom.setUTCDate(seriesFrom.getUTCDate() - 6);
  const series = await getDailySeries(seriesFrom, stats.date);

  const todayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(stats.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vue d&apos;ensemble</h1>
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/statistiques">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Statistiques
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/caisse">
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              Caisse
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/preparation">
              <ChefHat className="mr-1.5 h-4 w-4" />
              Préparation
            </Link>
          </Button>
        </div>
      </div>

      {/* Cartes de stats principales */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Commandes du jour"
          value={stats.totalOrders.toString()}
          Icon={TrendingUp}
          delta={{ pct: comparison.vsYesterday.orders.pct, label: 'vs hier' }}
          hint={lastWeekHint(comparison.vsLastWeek.orders)}
        />
        <KpiCard
          label="Revenu encaissé"
          value={`${priceFormatter.format(stats.revenue)} F`}
          Icon={Banknote}
          delta={{ pct: comparison.vsYesterday.revenue.pct, label: 'vs hier' }}
          hint={lastWeekHint(comparison.vsLastWeek.revenue)}
        />
        <KpiCard
          label="Actives"
          value={stats.activeOrders.toString()}
          Icon={Clock}
          subtle
        />
        <KpiCard
          label="Terminées"
          value={stats.completedOrders.toString()}
          Icon={CheckCheck}
          subtle
        />
      </div>

      {/* Charts : tendance 7 jours + répartition du jour */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Tendance — 7 derniers jours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={series} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type de commande (jour)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.totalOrders > 0 ? (
              <OrdersByTypeChart counts={stats.countByOrderType} />
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Aucune commande aujourd&apos;hui.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Détail breakdown */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modes de paiement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BreakdownRow
              Icon={Banknote}
              label="Espèces"
              count={stats.countByPaymentMode.CASH}
              revenue={stats.revenueByPaymentMode.CASH}
            />
            <BreakdownRow
              Icon={Smartphone}
              label="Wave"
              count={stats.countByPaymentMode.WAVE}
              revenue={stats.revenueByPaymentMode.WAVE}
            />
            <BreakdownRow
              Icon={Wallet}
              label="Autre"
              count={stats.countByPaymentMode.OTHER}
              revenue={stats.revenueByPaymentMode.OTHER}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type de commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <BreakdownRow
              Icon={ShoppingBag}
              label="À emporter"
              count={stats.countByOrderType.TAKEAWAY}
            />
            <BreakdownRow
              Icon={Coffee}
              label="Sur place"
              count={stats.countByOrderType.DINE_IN}
            />
            <BreakdownRow
              Icon={Bike}
              label="Livraison"
              count={stats.countByOrderType.DELIVERY}
            />
          </CardContent>
        </Card>
      </div>

      {/* Stats secondaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Statut paiement & annulations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Mini
            label="Encaissées"
            value={stats.paidOrders}
            total={stats.totalOrders}
          />
          <Mini
            label="À encaisser"
            value={stats.totalOrders - stats.paidOrders - stats.cancelledOrders}
            total={stats.totalOrders}
          />
          <Mini
            label="Annulées"
            value={stats.cancelledOrders}
            total={stats.totalOrders}
            destructive
          />
        </CardContent>
      </Card>

      {/* Stock bas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock bas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lowStock.length > 0 ? (
            lowStock.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 text-sm">
                  <Boxes className="h-4 w-4 text-muted-foreground" />
                  {item.name}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {`${stockFormatter.format(item.currentQuantity)} ${item.unit}`}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune alerte de stock.
            </p>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/inventaire">
              <Boxes className="mr-1.5 h-4 w-4" />
              Voir l&apos;inventaire
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** « vs même jour sem. dernière : +X % » (rien si la référence est vide). */
function lastWeekHint(delta: Delta): string | undefined {
  if (delta.pct === null) return undefined;
  const pct = Math.round(Math.abs(delta.pct) * 100);
  return `vs même jour sem. dernière : ${delta.pct >= 0 ? '+' : '−'}${pct} %`;
}

function BreakdownRow({
  Icon,
  label,
  count,
  revenue,
}: {
  Icon: typeof Banknote;
  label: string;
  count: number;
  revenue?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      <span className="flex items-baseline gap-3 text-sm">
        <span className="font-semibold tabular-nums">{count}</span>
        {revenue !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {priceFormatter.format(revenue)} F
          </span>
        )}
      </span>
    </div>
  );
}

function Mini({
  label,
  value,
  total,
  destructive,
}: {
  label: string;
  value: number;
  total: number;
  destructive?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'text-xl font-bold tabular-nums',
          destructive && 'text-destructive'
        )}
      >
        {value}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">
          · {pct}%
        </span>
      </p>
    </div>
  );
}
