import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { aggregateOrderSupplements } from '@/lib/orders/format';
import { kitchenLaunchState } from '@/lib/orders/scheduling';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { ORDER_TYPE_META } from '../prep-order-card';
import { elapsedMinutes } from '../elapsed';
import type { OrdersListVariant } from './types';

export function deriveRowState(
  variant: OrdersListVariant,
  order: PreparationOrder,
  now: Date
) {
  const TypeIcon = ORDER_TYPE_META[order.orderType].Icon;
  const isReady = variant === 'ready';
  const isToPay = variant === 'topay';
  const since = isReady
    ? (order.readyAt ?? order.createdAt)
    : (order.preparingStartedAt ?? order.createdAt);
  const mins = elapsedMinutes(since, now);
  const readyLate = isReady && mins >= READY_WAIT_ALERT_MINUTES;
  // Encore NEW : elle attend le geste humain (« Lancer la préparation »). Le stock
  // des programmées payées du jour est réservé dès qu'il arrive (cf.
  // lib/orders/stock-holds), mais seul le lancement les met en cuisine.
  const awaitingLaunch = order.status === 'NEW';
  // `now` : retrait dans 30 min ou moins ; `today` : retrait aujourd'hui,
  // à lancer dans la journée (cf. `kitchenLaunchState`).
  const launchState = kitchenLaunchState(order, now);
  const launchNow = launchState === 'now';
  const launchToday = launchState === 'today';
  const supplementLines = aggregateOrderSupplements(order.items);
  return {
    TypeIcon,
    isReady,
    isToPay,
    mins,
    readyLate,
    awaitingLaunch,
    launchNow,
    launchToday,
    supplementLines,
  };
}

export type RowState = ReturnType<typeof deriveRowState>;
