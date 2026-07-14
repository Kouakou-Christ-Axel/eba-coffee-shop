// Section "aujourd'hui" de la vue d'ensemble : KPIs du jour + répartition
// (type de commande, mode de paiement) + statut paiement/annulations. Un
// seul appel `compareDays()` pour tout ce bloc (JSX regroupé, contrairement
// à la page d'origine où le chart "Type de commande (jour)" était intercalé
// entre le grid de KPIs et le reste — regroupé ici pour former une section
// Suspense autonome, `trend-section.tsx` gère la tendance 7 jours à part).

import {
  Banknote,
  Bike,
  CheckCheck,
  Clock,
  Coffee,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { compareDays, type Delta } from '@/lib/stats-compare';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { OrdersByTypeChart } from '@/components/(dashboard)/charts/orders-by-type-chart';

const priceFormatter = new Intl.NumberFormat('fr-FR');

/** « vs même jour sem. dernière : +X % » (rien si la référence est vide). */
function lastWeekHint(delta: Delta): string | undefined {
  if (delta.pct === null) return undefined;
  const pct = Math.round(Math.abs(delta.pct) * 100);
  return `vs même jour sem. dernière : ${delta.pct >= 0 ? '+' : '−'}${pct} %`;
}

export async function TodayKpisSection() {
  const comparison = await compareDays();
  const stats = comparison.today;

  return (
    <>
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
    </>
  );
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
