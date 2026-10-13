'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPickupCode } from '@/lib/orders/format';
import { formatAbidjanTime } from '@/lib/timezone';
import type { ReopenKind } from '@/lib/orders/reopen';
import type { ClosedOrderWithPlan } from './use-closed-orders';

const priceFormatter = new Intl.NumberFormat('fr-FR');

export const KIND_META: Record<
  ReopenKind,
  { label: string; badge: string; verb: string }
> = {
  completed: {
    label: 'Récupérées',
    badge:
      'bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-100',
    verb: 'récupérée',
  },
  cancelled: {
    label: 'Annulées',
    badge: 'bg-muted text-muted-foreground',
    verb: 'annulée',
  },
  refunded: {
    label: 'Remboursées',
    badge: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-100',
    verb: 'remboursée',
  },
  expired: {
    label: 'Expirées',
    badge:
      'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100',
    verb: 'expirée',
  },
};

export function ReopenRow({
  order,
  busy,
  disabled,
  onReopen,
}: {
  order: ClosedOrderWithPlan;
  busy: boolean;
  disabled: boolean;
  onReopen: () => void;
}) {
  const meta = KIND_META[order.plan.kind];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xl font-bold leading-none">
          #{String(order.dailyNumber).padStart(3, '0')}
          <span
            className="rounded bg-primary/10 px-1.5 py-0.5 text-base text-primary"
            title="Code de retrait"
          >
            {getPickupCode(order.reference)}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-sans text-xs font-semibold',
              meta.badge
            )}
          >
            {meta.verb}
          </span>
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {order.customerName ?? 'Client anonyme'}
          {order.customerPhone ? ` · ${order.customerPhone}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          {priceFormatter.format(order.total)} FCFA · à{' '}
          {formatAbidjanTime(new Date(order.updatedAt))}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{order.plan.hint}</p>
      </div>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11"
        disabled={disabled || busy}
        onClick={onReopen}
      >
        <RotateCcw className="h-4 w-4" />
        {order.plan.label}
      </Button>
    </li>
  );
}
