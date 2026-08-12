'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './chart-skeleton';

export const PaymentModeChart = dynamic(
  () => import('./payment-mode-chart.client').then((m) => m.PaymentModeChart),
  {
    ssr: false,
    loading: () => (
      <ChartSkeleton className="mx-auto aspect-square max-h-[240px]" />
    ),
  }
);
