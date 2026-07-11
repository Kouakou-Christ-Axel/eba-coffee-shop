'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Point = {
  date: string;
  /** Temps de préparation moyen du jour en minutes (null = aucune mesure). */
  avgPrepMin: number | null;
  measured: number;
};

const config = {
  avgPrepMin: { label: 'Préparation moy. (min)', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function dayShort(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

function dayLong(value: unknown): string {
  if (typeof value !== 'string') return '';
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(d);
}

export function KitchenTrendChart({ data }: { data: Point[] }) {
  const reduced = useReducedMotion();

  if (data.every((p) => p.avgPrepMin === null)) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Aucun temps de préparation mesuré sur la période.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <LineChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dayShort}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis hide />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={dayLong} />}
        />
        <Line
          dataKey="avgPrepMin"
          type="monotone"
          stroke="var(--color-avgPrepMin)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={!reduced}
        />
      </LineChart>
    </ChartContainer>
  );
}
