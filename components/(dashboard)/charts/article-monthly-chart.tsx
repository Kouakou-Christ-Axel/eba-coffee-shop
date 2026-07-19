'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from 'framer-motion';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

export type MonthlyPoint = { month: string; value: number };

const compactFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact' });

/** Mois 'YYYY-MM' → « juin 26 ». */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat('fr-FR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/**
 * Barres d'une métrique par mois civil (quantité ou montant). Générique :
 * réutilisé pour la quantité achetée/mois, le montant dépensé/mois (fiche
 * article) et la tendance des achats détaillés (vue d'ensemble).
 */
export function ArticleMonthlyChart({
  data,
  label,
  color = 'var(--chart-1)',
  height = 200,
  emptyText = 'Aucune donnée sur la période.',
  valueFormatter,
}: {
  data: MonthlyPoint[];
  label: string;
  color?: string;
  height?: number;
  emptyText?: string;
  valueFormatter?: (value: number) => string;
}) {
  const reduced = useReducedMotion();
  const config = { value: { label, color } } satisfies ChartConfig;
  const fmtY = valueFormatter ?? ((v: number) => compactFmt.format(v));

  if (data.length === 0 || data.every((p) => p.value === 0)) {
    return (
      <div
        className="flex items-center justify-center px-4 text-center text-sm text-muted-foreground"
        style={{ height }}
      >
        {emptyText}
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
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={monthLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={fmtY}
        />
        <ChartTooltip
          content={<ChartTooltipContent indicator="dot" />}
          labelFormatter={(l) => monthLabel(String(l))}
        />
        <Bar
          dataKey="value"
          fill="var(--color-value)"
          radius={[4, 4, 0, 0]}
          isAnimationActive={!reduced}
        />
      </BarChart>
    </ChartContainer>
  );
}
