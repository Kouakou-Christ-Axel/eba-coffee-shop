'use client';

import dynamic from 'next/dynamic';
import { barListHeight } from './chart-layout';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { TopProduct } from './top-products-chart.client';

const Chart = dynamic(
  () => import('./top-products-chart.client').then((m) => m.TopProductsChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  if (data.length === 0) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucune vente sur la période.
      </ChartEmpty>
    );
  }

  return (
    <div style={{ height: barListHeight(data.length, { min: 200, step: 40 }) }}>
      <Chart data={data} />
    </div>
  );
}
