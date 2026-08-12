'use client';

import dynamic from 'next/dynamic';
import { barListHeight } from './chart-layout';
import { ChartSkeleton } from './chart-skeleton';
import type { ArticleSupplierPriceChartProps } from './article-supplier-price-chart.client';

const Chart = dynamic(
  () =>
    import('./article-supplier-price-chart.client').then(
      (m) => m.ArticleSupplierPriceChart
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function ArticleSupplierPriceChart(
  props: ArticleSupplierPriceChartProps
) {
  return (
    <div
      style={{
        height: barListHeight(props.data.length, { min: 140, step: 40 }),
      }}
    >
      <Chart {...props} />
    </div>
  );
}
