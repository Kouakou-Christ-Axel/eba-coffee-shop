'use client';

import dynamic from 'next/dynamic';
import { barListHeight } from './chart-layout';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { TopArticleRow } from './top-articles-chart.client';

const Chart = dynamic(
  () => import('./top-articles-chart.client').then((m) => m.TopArticlesChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function TopArticlesChart({ data }: { data: TopArticleRow[] }) {
  if (data.length === 0) {
    return (
      <ChartEmpty className="h-[200px]">
        Aucun achat détaillé sur la période.
      </ChartEmpty>
    );
  }

  return (
    <div style={{ height: barListHeight(data.length, { min: 180, step: 38 }) }}>
      <Chart data={data} />
    </div>
  );
}
