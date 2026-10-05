'use client';

import type { PaymentMode } from '@/generated/prisma/client';
import type { ChartConfig } from '@/components/ui/chart';
import { DonutChart, type DonutSlice } from './donut-chart';

const config = {
  CASH: { label: 'Espèces', color: 'var(--chart-1)' },
  WAVE: { label: 'Wave', color: 'var(--chart-2)' },
  ORANGE_MONEY: { label: 'Orange Money', color: 'var(--chart-3)' },
  MTN_MONEY: { label: 'MTN Money', color: 'var(--chart-4)' },
  MOOV_MONEY: { label: 'Moov Money', color: 'var(--chart-5)' },
  DJAMO: { label: 'Djamo', color: 'oklch(0.6 0.1 200)' },
  OTHER: { label: 'Autre', color: 'oklch(0.7 0.02 280)' },
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
    {
      key: 'MTN_MONEY',
      value: revenueByMode.MTN_MONEY,
      fill: 'var(--color-MTN_MONEY)',
    },
    {
      key: 'MOOV_MONEY',
      value: revenueByMode.MOOV_MONEY,
      fill: 'var(--color-MOOV_MONEY)',
    },
    { key: 'DJAMO', value: revenueByMode.DJAMO, fill: 'var(--color-DJAMO)' },
    { key: 'OTHER', value: revenueByMode.OTHER, fill: 'var(--color-OTHER)' },
  ];
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <DonutChart data={data} config={config} total={total} totalLabel="F" />
  );
}
