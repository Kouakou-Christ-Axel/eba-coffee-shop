'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from './chart-skeleton';

/**
 * `recharts` pèse ~367 Ko (105 Ko gzip) : il est chargé après l'hydratation
 * plutôt que dans le payload initial de la route. Cf. `chart-skeleton.tsx`.
 */
export const StatusBreakdownChart = dynamic(
  () =>
    import('./status-breakdown-chart.client').then(
      (m) => m.StatusBreakdownChart
    ),
  { ssr: false, loading: () => <ChartSkeleton className="h-[240px]" /> }
);
