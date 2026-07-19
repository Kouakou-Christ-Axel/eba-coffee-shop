'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
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

type Point = { date: string; unitPrice: number };

const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

/** YYYY-MM-DD → « 5 mars » (ticks). */
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
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Évolution du prix unitaire (F / unité de base) d'un article dans le temps.
 * Deux repères pointillés optionnels : le prix de référence en gros et le prix
 * moyen pondéré sur la période. Sert à repérer les hausses fournisseurs.
 */
export function ArticlePriceTrendChart({
  data,
  baseUnit,
  refPrice,
  avgPrice,
}: {
  data: Point[];
  baseUnit: string | null;
  refPrice: number | null;
  avgPrice: number | null;
}) {
  const reduced = useReducedMotion();
  const unitSuffix = baseUnit ? `/${baseUnit}` : '';
  const config = {
    unitPrice: { label: `Prix (F${unitSuffix})`, color: 'var(--chart-1)' },
  } satisfies ChartConfig;

  if (data.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Au moins deux achats avec quantité sont nécessaires pour tracer
        l’évolution du prix.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <LineChart data={data} margin={{ left: 8, right: 16, top: 12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={dayShort}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={dayLong} />}
        />
        {refPrice != null && refPrice > 0 && (
          <ReferenceLine
            y={refPrice}
            stroke="var(--chart-2)"
            strokeDasharray="4 4"
            label={{
              value: 'réf. gros',
              position: 'insideTopRight',
              fontSize: 10,
              fill: 'var(--chart-2)',
            }}
          />
        )}
        {avgPrice != null && avgPrice > 0 && (
          <ReferenceLine
            y={avgPrice}
            stroke="var(--muted-foreground)"
            strokeDasharray="2 2"
            label={{
              value: 'moyenne',
              position: 'insideBottomRight',
              fontSize: 10,
              fill: 'var(--muted-foreground)',
            }}
          />
        )}
        <Line
          dataKey="unitPrice"
          type="monotone"
          stroke="var(--color-unitPrice)"
          strokeWidth={2}
          dot={{ r: 2 }}
          activeDot={{ r: 4 }}
          isAnimationActive={!reduced}
        />
      </LineChart>
    </ChartContainer>
  );
}
