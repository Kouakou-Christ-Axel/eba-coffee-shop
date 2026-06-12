'use client';

import * as React from 'react';
import { Label, Pie, PieChart } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type DonutSlice = {
  /** Clé technique (utilisée comme nameKey, mappée dans la config). */
  key: string;
  value: number;
  fill: string;
};

/**
 * Donut générique avec total centré. Les libellés/couleurs viennent de `config`
 * (clé = `slice.key`). Réutilisé par les charts type de commande / mode paiement.
 */
export function DonutChart({
  data,
  config,
  total,
  totalLabel,
  className,
}: {
  data: DonutSlice[];
  config: ChartConfig;
  total: number;
  totalLabel: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hasData = data.some((d) => d.value > 0);

  return (
    <ChartContainer
      config={config}
      className={className ?? 'mx-auto aspect-square max-h-[240px]'}
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey="key" hideLabel />}
        />
        <Pie
          data={
            hasData ? data : [{ key: 'empty', value: 1, fill: 'var(--muted)' }]
          }
          dataKey="value"
          nameKey="key"
          innerRadius={60}
          strokeWidth={4}
          isAnimationActive={!reduced}
        >
          <Label
            content={({ viewBox }) => {
              if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) {
                return null;
              }
              return (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className="fill-foreground text-2xl font-bold"
                  >
                    {total.toLocaleString('fr-FR')}
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 20}
                    className="fill-muted-foreground text-xs"
                  >
                    {totalLabel}
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="key" />}
          verticalAlign="bottom"
        />
      </PieChart>
    </ChartContainer>
  );
}
