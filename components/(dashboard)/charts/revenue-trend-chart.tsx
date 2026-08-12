'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './chart-skeleton';

export const RevenueTrendChart = dynamic(
  () => import('./revenue-trend-chart.client').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[260px]" /> }
);
