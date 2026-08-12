'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type TopArticleRow = { name: string; amount: number };

const config = {
  amount: { label: 'Dépense (F)', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/**
 * Top articles par dépense sur la sélection (barres horizontales, Pareto « où
 * part l'argent »). L'appelant fournit déjà la liste tronquée et triée.
 */
export function TopArticlesChart({ data }: { data: TopArticleRow[] }) {
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
