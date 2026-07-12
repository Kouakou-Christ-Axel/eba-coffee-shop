'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

type HourlyPoint = { hour: number; orders: number; revenue: number };

const config = {
  orders: { label: 'Commandes', color: 'var(--chart-1)' },
  revenue: { label: 'CA encaissé (F)', color: 'var(--chart-2)' },
} satisfies ChartConfig;

function hourRange(value: unknown): string {
  const h = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(h)) return '';
  return `${h}h – ${(h + 1) % 24}h`;
}

export function PeakHoursChart({ data }: { data: HourlyPoint[] }) {
  const reduced = useReducedMotion();

  if (data.every((p) => p.orders === 0)) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Aucune commande sur la période.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <ComposedChart data={data} margin={{ left: 12, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickFormatter={(h: number) => `${h}h`}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={1}
        />
        <YAxis yAxisId="orders" hide />
        <YAxis yAxisId="revenue" orientation="right" hide />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={hourRange} />}
        />
        <Bar
          yAxisId="orders"
          dataKey="orders"
          fill="var(--color-orders)"
          radius={[6, 6, 0, 0]}
          isAnimationActive={!reduced}
        />
        <Line
          yAxisId="revenue"
          dataKey="revenue"
          type="monotone"
          stroke="var(--color-revenue)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={!reduced}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
