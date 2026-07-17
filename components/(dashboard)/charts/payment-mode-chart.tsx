'use client';

import type { PaymentMode } from '@/generated/prisma/client';
import type { ChartConfig } from '@/components/ui/chart';
import { DonutChart, type DonutSlice } from './donut-chart';

const config = {
  CASH: { label: 'Espèces', color: 'var(--chart-1)' },
  WAVE: { label: 'Wave', color: 'var(--chart-2)' },
  ORANGE_MONEY: { label: 'Orange Money', color: 'var(--chart-3)' },
  OTHER: { label: 'Autre', color: 'var(--chart-4)' },
} satisfies ChartConfig;

/**
 * Répartition du CA encaissé par mode de paiement (montants en FCFA).
 */
export function PaymentModeChart({
  revenueByMode,
}: {
  revenueByMode: Record<PaymentMode, number>;
}) {
  const data: DonutSlice[] = [
    { key: 'CASH', value: revenueByMode.CASH, fill: 'var(--color-CASH)' },
    { key: 'WAVE', value: revenueByMode.WAVE, fill: 'var(--color-WAVE)' },
    {
      key: 'ORANGE_MONEY',
      value: revenueByMode.ORANGE_MONEY,
      fill: 'var(--color-ORANGE_MONEY)',
    },
    { key: 'OTHER', value: revenueByMode.OTHER, fill: 'var(--color-OTHER)' },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <DonutChart data={data} config={config} total={total} totalLabel="F" />
  );
}
