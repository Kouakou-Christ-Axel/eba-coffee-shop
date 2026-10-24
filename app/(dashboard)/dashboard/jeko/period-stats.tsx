import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartEmpty } from '@/components/(dashboard)/charts/chart-empty';
import type { JekoAccount } from '@/lib/jeko/accounts';
import { getJekoStats } from '@/lib/jeko/stats';
import { CollectionChart } from './collection-chart';
import { ConversionCard } from './conversion-card';
import { FeesTable } from './fees-table';
import { PeriodKpis } from './period-kpis';

/** Tout ce qui dépend de la plage : chiffres, courbe, frais, conversion. */
export async function PeriodStats({
  account,
  from,
  to,
}: {
  account: JekoAccount | null;
  from: string;
  to: string;
}) {
  const stats = await getJekoStats({ account, from, to });
  const { totals, series, granularity } = stats;

  return (
    <div className="space-y-6">
      <PeriodKpis totals={totals} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Encaissements {granularity === 'month' ? 'par mois' : 'par jour'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totals.count === 0 ? (
            <ChartEmpty className="h-[260px]">
              Aucun paiement en ligne encaissé sur cette période.
            </ChartEmpty>
          ) : (
            <CollectionChart data={series} split={account === null} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FeesTable stats={stats} />
        <ConversionCard
          conversion={stats.conversion}
          averageBasket={totals.averageBasket}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Les encaissements sont datés du paiement. Une commande dépayée ensuite
        n’y figure plus : les cumuls peuvent être légèrement sous-estimés.
      </p>
    </div>
  );
}
