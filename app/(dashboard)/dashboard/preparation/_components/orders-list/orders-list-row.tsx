'use client';

import { cn } from '@/lib/utils';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { deriveRowState } from './row-state';
import { RowActions } from './row-actions';
import { RowSummary } from './row-summary';
import type { OrdersListVariant, RowCallbacks } from './types';

export function OrdersListRow({
  variant,
  order,
  now,
  onExpand,
  pending,
  ...callbacks
}: Omit<RowCallbacks, 'onExpand'> & {
  variant: OrdersListVariant;
  order: PreparationOrder;
  now: Date;
  onExpand: (id: string) => void;
  pending: boolean;
}) {
  const state = deriveRowState(variant, order, now);
  const { isReady, isToPay, readyLate, launchNow, launchToday } = state;

  return (
    <li
      className={cn(
        'rounded-2xl border-2 bg-card shadow-sm',
        isReady
          ? readyLate
            ? 'border-red-300 dark:border-red-800'
            : 'border-green-300 dark:border-green-800'
          : isToPay
            ? 'border-orange-300 dark:border-orange-800'
            : launchNow
              ? 'border-red-300 dark:border-red-800'
              : launchToday
                ? 'border-amber-300 dark:border-amber-800'
                : 'border-border'
      )}
    >
      <RowSummary order={order} now={now} state={state} onExpand={onExpand} />

      <RowActions
        order={order}
        state={state}
        pending={pending}
        {...callbacks}
      />
    </li>
  );
}
