'use client';

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { SeriesPoint } from '@/lib/jeko/stats';

const config = {
  collected: { label: 'Encaissé (F)', color: 'var(--chart-1)' },
  count: { label: 'Paiements', color: 'var(--chart-2)' },
  A: { label: 'Compte A (F)', color: 'var(--chart-1)' },
  B: { label: 'Compte B (F)', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function label(value: unknown, long: boolean): string {
  if (typeof value !== 'string') return '';
  const monthly = value.length === 7;
  const d = new Date(`${value}${monthly ? '-01' : ''}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    ...(monthly
      ? { month: long ? 'long' : 'short', year: long ? 'numeric' : undefined }
      : { day: 'numeric', month: long ? 'long' : 'short' }),
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Encaissements par jour (par mois sur une longue plage). `split` : une aire
 * empilée par compte, pour « Tous les comptes ».
 */
export function CollectionChart({
  data,
  split,
}: {
  data: SeriesPoint[];
  split: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => label(v, false)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis yAxisId="amount" hide />
        <YAxis yAxisId="count" orientation="right" hide />
        <ChartTooltip
          content={
            <ChartTooltipContent labelFormatter={(v) => label(v, true)} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {split ? (
          <>
            <Area
              yAxisId="amount"
              dataKey="A"
              stackId="accounts"
              type="monotone"
              fill="var(--color-A)"
              fillOpacity={0.35}
              stroke="var(--color-A)"
              strokeWidth={2}
              isAnimationActive={!reduced}
            />
            <Area
              yAxisId="amount"
              dataKey="B"
              stackId="accounts"
              type="monotone"
              fill="var(--color-B)"
              fillOpacity={0.35}
              stroke="var(--color-B)"
              strokeWidth={2}
              isAnimationActive={!reduced}
            />
          </>
        ) : (
          <Area
            yAxisId="amount"
            dataKey="collected"
            type="monotone"
            fill="var(--color-collected)"
            fillOpacity={0.3}
            stroke="var(--color-collected)"
            strokeWidth={2}
            isAnimationActive={!reduced}
          />
        )}
        <Line
          yAxisId="count"
          dataKey="count"
          type="monotone"
          stroke="var(--color-count)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduced}
        />
      </AreaChart>
    </ChartContainer>
  );
}
