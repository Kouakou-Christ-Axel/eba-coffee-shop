'use client';

import type { PaymentMode } from '@/generated/prisma/client';
import type { ChartConfig } from '@/components/ui/chart';
import { PaymentMethodIcon } from '@/components/payment-method-badge';
import { PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { DonutChart, type DonutSlice } from './donut-chart';

/**
 * Icône de légende : pastille de couleur (cohérence avec le donut) + logo de
 * la marque. `itemConfig.icon` (cf. `components/ui/chart.tsx`) remplace
 * entièrement la pastille par défaut si fourni — on la redessine donc ici au
 * lieu de la perdre.
 */
function legendIcon(mode: PaymentMode, color: string) {
  return function PaymentLegendIcon() {
    return (
      <span className="flex items-center gap-1">
        <span
          className="h-2 w-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        <PaymentMethodIcon mode={mode} className="h-3.5 w-3.5" />
      </span>
    );
  };
}

const COLORS: Record<PaymentMode, string> = {
  CASH: 'var(--chart-1)',
  WAVE: 'var(--chart-2)',
  ORANGE_MONEY: 'var(--chart-3)',
  MTN_MONEY: 'var(--chart-4)',
  MOOV_MONEY: 'var(--chart-5)',
  DJAMO: 'oklch(0.6 0.1 200)',
  OTHER: 'oklch(0.7 0.02 280)',
};

const config = Object.fromEntries(
  (Object.keys(COLORS) as PaymentMode[]).map((mode) => [
    mode,
    {
      label: PAYMENT_MODE_LABELS[mode],
      color: COLORS[mode],
      icon: legendIcon(mode, COLORS[mode]),
    },
  ])
) satisfies ChartConfig;

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
