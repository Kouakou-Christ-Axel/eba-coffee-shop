'use client';

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type Point = { date: string; orders: number; revenue: number };

const config = {
  revenue: { label: 'CA encaissé (F)', color: 'var(--chart-1)' },
  orders: { label: 'Commandes', color: 'var(--chart-2)' },
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

export function RevenueTrendChart({
  data,
  className,
}: {
  data: Point[];
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <ChartContainer
      config={config}
      className={className ?? 'aspect-auto h-[260px] w-full'}
    >
      <AreaChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--color-revenue)"
              stopOpacity={0.6}
            />
            <stop
              offset="95%"
              stopColor="var(--color-revenue)"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={dayShort}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis yAxisId="revenue" hide />
        <YAxis yAxisId="orders" orientation="right" hide />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={dayLong} />}
        />
        <Area
          yAxisId="revenue"
          dataKey="revenue"
          type="monotone"
          fill="url(#fillRevenue)"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          isAnimationActive={!reduced}
        />
        <Line
          yAxisId="orders"
          dataKey="orders"
          type="monotone"
          stroke="var(--color-orders)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduced}
        />
      </AreaChart>
    </ChartContainer>
  );
}
