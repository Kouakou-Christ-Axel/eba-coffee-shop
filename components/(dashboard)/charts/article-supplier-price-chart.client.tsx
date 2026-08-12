'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type SupplierPriceRow = {
  supplier: string;
  avgUnitPrice: number;
  count: number;
};

export type ArticleSupplierPriceChartProps = {
  data: SupplierPriceRow[];
  baseUnit: string | null;
};

/**
 * Prix unitaire moyen (F / unité de base) par fournisseur : répond à « chez qui
 * est-ce le moins cher ? ». Ne s'affiche que si au moins deux fournisseurs sont
 * comparables (décidé par l'appelant).
 */
export function ArticleSupplierPriceChart({
  data,
  baseUnit,
}: ArticleSupplierPriceChartProps) {
  const reduced = useReducedMotion();
  const unitSuffix = baseUnit ? `/${baseUnit}` : '';
  const config = {
    avgUnitPrice: {
      label: `Prix moyen (F${unitSuffix})`,
      color: 'var(--chart-4)',
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto size-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" dataKey="avgUnitPrice" hide />
        <YAxis
          type="category"
          dataKey="supplier"
          tickLine={false}
          axisLine={false}
          width={110}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Bar
          dataKey="avgUnitPrice"
          fill="var(--color-avgUnitPrice)"
          radius={[0, 6, 6, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
