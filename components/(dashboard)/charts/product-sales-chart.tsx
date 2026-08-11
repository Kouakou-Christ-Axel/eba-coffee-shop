'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { ProductSalesPoint } from '@/lib/product-stats';

const config = {
  quantity: { label: 'Unités vendues', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact' });
const priceFmt = new Intl.NumberFormat('fr-FR');

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

/**
 * Ventes quotidiennes d'un produit (barres = unités). Le CA du jour est
 * affiché dans l'infobulle plutôt que sur un second axe : deux échelles très
 * éloignées (unités vs FCFA) écraseraient la courbe des unités.
 */
export function ProductSalesChart({
  data,
  height = 220,
}: {
  data: ProductSalesPoint[];
  height?: number;
}) {
  const reduced = useReducedMotion();

  if (data.length === 0 || data.every((p) => p.quantity === 0)) {
    return (
      <div
        className="flex items-center justify-center px-4 text-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Aucune vente sur la période.
      </div>
    );
  }

  return (
    <ChartContainer
      config={config}
      className="aspect-auto w-full"
      style={{ height }}
    >
      <BarChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={dayShort}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          allowDecimals={false}
          tickFormatter={(v: number) => compactFmt.format(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(value, _name, _item, _index, payload) => {
                const point = payload as ProductSalesPoint | undefined;
                return (
                  <span className="tabular-nums">
                    {priceFmt.format(Number(value))} unité
                    {Number(value) > 1 ? 's' : ''}
                    {point ? ` · ${priceFmt.format(point.revenue)} F` : ''}
                  </span>
                );
              }}
            />
          }
          labelFormatter={dayLong}
        />
        <Bar
          dataKey="quantity"
          fill="var(--color-quantity)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
