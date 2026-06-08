'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Slice = { name: string; amount: number };

const config = {
  amount: { label: 'Dépenses (F)', color: 'var(--chart-4)' },
} satisfies ChartConfig;

export function ExpensesByCategoryChart({ data }: { data: Slice[] }) {
  const reduced = useReducedMotion();

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur la période.
      </div>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height: Math.max(200, data.length * 40) }}
    >
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
