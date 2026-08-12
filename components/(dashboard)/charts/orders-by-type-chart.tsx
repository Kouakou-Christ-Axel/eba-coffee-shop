'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './chart-skeleton';

export const OrdersByTypeChart = dynamic(
  () =>
    import('./orders-by-type-chart.client').then((m) => m.OrdersByTypeChart),
  {
    ssr: false,
    loading: () => (
      <ChartSkeleton className="mx-auto aspect-square max-h-[240px]" />
    ),
  }
);
