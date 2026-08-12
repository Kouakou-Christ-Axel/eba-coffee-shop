'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { HourlyPoint } from './peak-hours-chart.client';

const Chart = dynamic(
  () => import('./peak-hours-chart.client').then((m) => m.PeakHoursChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[260px]" /> }
);

export function PeakHoursChart({ data }: { data: HourlyPoint[] }) {
  if (data.every((p) => p.orders === 0)) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucune commande sur la période.
      </ChartEmpty>
    );
  }

  return <Chart data={data} />;
}
