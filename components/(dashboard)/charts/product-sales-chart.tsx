'use client';

import dynamic from 'next/dynamic';
import { ChartEmpty } from './chart-empty';
import { ChartSkeleton } from './chart-skeleton';
import type { ProductSalesPoint } from '@/lib/product-stats';

const Chart = dynamic(
  () => import('./product-sales-chart.client').then((m) => m.ProductSalesChart),
  { ssr: false, loading: () => <ChartSkeleton className="h-full" /> }
);

export function ProductSalesChart({
  data,
  height = 220,
}: {
  data: ProductSalesPoint[];
  height?: number;
}) {
  if (data.length === 0 || data.every((p) => p.quantity === 0)) {
    return (
      <ChartEmpty style={{ height }}>Aucune vente sur la période.</ChartEmpty>
    );
  }

  return (
    <div style={{ height }}>
      <Chart data={data} />
    </div>
  );
}
