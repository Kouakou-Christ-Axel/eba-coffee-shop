'use client';

import dynamic from 'next/dynamic';
import { barListHeight } from './chart-layout';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { SourceAmount } from './investments-by-source-chart.client';

const Chart = dynamic(
  () =>
    import('./investments-by-source-chart.client').then(
      (m) => m.InvestmentsBySourceChart
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function InvestmentsBySourceChart({ data }: { data: SourceAmount[] }) {
  if (data.length === 0) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucun apport sur la période.
      </ChartEmpty>
    );
  }

  return (
    <div style={{ height: barListHeight(data.length, { min: 200, step: 40 }) }}>
      <Chart data={data} />
    </div>
  );
}
