'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Point = { month: string; total: number; fixed: number; variable: number };

const config = {
  fixed: { label: 'Fixes (F)', color: 'var(--chart-1)' },
  variable: { label: 'Variables (F)', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

/** Mois 'YYYY-MM' → « juin 26 » (affichage des ticks). */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Dépenses par mois, empilées charges fixes / dépenses variables. */
export function ExpenseTrendChart({ data }: { data: Point[] }) {
  const reduced = useReducedMotion();

  if (data.every((p) => p.total === 0)) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur la période.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ left: 8, right: 16 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={monthLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(label) => monthLabel(String(label))}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="fixed"
          stackId="expenses"
          fill="var(--color-fixed)"
          radius={[0, 0, 4, 4]}
          isAnimationActive={!reduced}
        />
        <Bar
          dataKey="variable"
          stackId="expenses"
          fill="var(--color-variable)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
