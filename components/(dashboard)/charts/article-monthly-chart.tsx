'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { ArticleMonthlyChartProps } from './article-monthly-chart.client';

export type { MonthlyPoint } from './article-monthly-chart.client';

const Chart = dynamic(
  () =>
    import('./article-monthly-chart.client').then((m) => m.ArticleMonthlyChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function ArticleMonthlyChart({
  height = 200,
  emptyText = 'Aucune donnée sur la période.',
  ...props
}: ArticleMonthlyChartProps & { height?: number; emptyText?: string }) {
  if (props.data.length === 0 || props.data.every((p) => p.value === 0)) {
    return <ChartEmpty style={{ height }}>{emptyText}</ChartEmpty>;
  }

  return (
    <div style={{ height }}>
      <Chart {...props} />
    </div>
  );
}
