import { ChefHat, Hourglass } from 'lucide-react';
import { getKitchenPerformance } from '@/lib/stats-operations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/(dashboard)/kpi-card';
import { KitchenTrendChart } from '@/components/(dashboard)/charts/kitchen-trend-chart';

const priceFormatter = new Intl.NumberFormat('fr-FR');

/** Durée en secondes → « 4 min 30 s » (ou « — » si non mesurable). */
function formatDuration(sec: number | null): string {
  if (sec === null) return '—';
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  if (minutes === 0) return `${seconds} s`;
  return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
}

export async function KitchenSection({ from, to }: { from: Date; to: Date }) {
  const kitchen = await getKitchenPerformance(from, to);
  const kitchenByDay = kitchen.byDay.map((d) => ({
    date: d.date,
    avgPrepMin: d.avgPrepSec !== null ? Math.round(d.avgPrepSec / 60) : null,
    measured: d.measured,
  }));

  return (
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
  );
}
