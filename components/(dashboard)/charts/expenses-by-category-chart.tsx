'use client';

import dynamic from 'next/dynamic';
import { barListHeight } from './chart-layout';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { CategoryAmount } from './expenses-by-category-chart.client';

const Chart = dynamic(
  () =>
    import('./expenses-by-category-chart.client').then(
      (m) => m.ExpensesByCategoryChart
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function ExpensesByCategoryChart({ data }: { data: CategoryAmount[] }) {
  if (data.length === 0) {
    return (
      <ChartEmpty className="h-[240px]">
        Aucune dépense sur la période.
      </ChartEmpty>
    );
  }

  return (
    <div style={{ height: barListHeight(data.length, { min: 200, step: 40 }) }}>
      <Chart data={data} />
    </div>
  );
}
