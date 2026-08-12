'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { ArticlePriceTrendChartProps } from './article-price-trend-chart.client';

const Chart = dynamic(
  () =>
    import('./article-price-trend-chart.client').then(
      (m) => m.ArticlePriceTrendChart
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-[220px]" /> }
);

export function ArticlePriceTrendChart(props: ArticlePriceTrendChartProps) {
  if (props.data.length < 2) {
    return (
      <ChartEmpty className="h-[200px]">
        Au moins deux achats avec quantité sont nécessaires pour tracer
        l’évolution du prix.
      </ChartEmpty>
    );
  }

  return <Chart {...props} />;
}
