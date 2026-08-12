'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type TopProduct = { name: string; quantity: number; revenue: number };

const config = {
  quantity: { label: 'Quantité', color: 'var(--chart-1)' },
} satisfies ChartConfig;

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  const reduced = useReducedMotion();

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" dataKey="quantity" hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={140}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Bar
          dataKey="quantity"
          fill="var(--color-quantity)"
          radius={[0, 6, 6, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
