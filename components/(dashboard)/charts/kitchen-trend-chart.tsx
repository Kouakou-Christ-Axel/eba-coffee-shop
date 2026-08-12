'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { KitchenTrendPoint } from './kitchen-trend-chart.client';

const Chart = dynamic(
  () => import('./kitchen-trend-chart.client').then((m) => m.KitchenTrendChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[240px]" /> }
);

export function KitchenTrendChart({ data }: { data: KitchenTrendPoint[] }) {
  if (data.every((p) => p.avgPrepMin === null)) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucun temps de préparation mesuré sur la période.
      </ChartEmpty>
    );
  }

  return <Chart data={data} />;
}
