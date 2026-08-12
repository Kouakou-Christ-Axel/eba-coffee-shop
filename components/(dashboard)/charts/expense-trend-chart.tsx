'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { ExpenseTrendPoint } from './expense-trend-chart.client';

const Chart = dynamic(
  () => import('./expense-trend-chart.client').then((m) => m.ExpenseTrendChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[260px]" /> }
);

export function ExpenseTrendChart({ data }: { data: ExpenseTrendPoint[] }) {
  if (data.length === 0 || data.every((p) => p.total === 0)) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucune dépense sur la période.
      </ChartEmpty>
    );
  }

  return <Chart data={data} />;
}
