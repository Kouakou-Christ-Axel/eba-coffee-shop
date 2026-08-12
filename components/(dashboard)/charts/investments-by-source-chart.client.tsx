'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type SourceAmount = { name: string; amount: number };

const config = {
  amount: { label: 'Apports (F)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export function InvestmentsBySourceChart({ data }: { data: SourceAmount[] }) {
  const reduced = useReducedMotion();

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" dataKey="amount" hide />
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
          dataKey="amount"
          fill="var(--color-amount)"
          radius={[0, 6, 6, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
