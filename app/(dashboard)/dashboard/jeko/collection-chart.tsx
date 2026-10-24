'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/(dashboard)/charts/chart-skeleton';

export const CollectionChart = dynamic(
  () => import('./collection-chart.client').then((m) => m.CollectionChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-[260px]" /> }
);
