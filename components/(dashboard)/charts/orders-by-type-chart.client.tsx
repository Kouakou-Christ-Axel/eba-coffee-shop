'use client';

import type { OrderType } from '@/generated/prisma/client';
import type { ChartConfig } from '@/components/ui/chart';
import { DonutChart, type DonutSlice } from './donut-chart';

const config = {
  TAKEAWAY: { label: 'À emporter', color: 'var(--chart-1)' },
  DINE_IN: { label: 'Sur place', color: 'var(--chart-2)' },
  DELIVERY: { label: 'Livraison', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function OrdersByTypeChart({
  counts,
}: {
  counts: Record<OrderType, number>;
}) {
  const data: DonutSlice[] = [
    { key: 'TAKEAWAY', value: counts.TAKEAWAY, fill: 'var(--color-TAKEAWAY)' },
    { key: 'DINE_IN', value: counts.DINE_IN, fill: 'var(--color-DINE_IN)' },
    { key: 'DELIVERY', value: counts.DELIVERY, fill: 'var(--color-DELIVERY)' },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <DonutChart
      data={data}
      config={config}
      total={total}
      totalLabel="commandes"
    />
  );
}
