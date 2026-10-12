'use client';

import { PackageCheck, Timer } from 'lucide-react';
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { getPickupCode } from '@/lib/orders/format';
import { formatPickup } from '@/lib/orders/scheduling';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { ORDER_TYPE_META, SOURCE_META } from '../prep-order-card';
import {
  elapsedMinutes,
  elapsedTone,
  formatElapsed,
  KITCHEN_ALERT_MIN,
  KITCHEN_WARN_MIN,
  TONE_CLASS,
} from '../elapsed';

export function OrderDetailHeader({
  order,
  now,
}: {
  order: PreparationOrder;
  now: Date;
}) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const isReady = order.status === 'READY';
  // Chrono : « en cuisine depuis X » (PREPARING) ou « prête depuis X » (READY).
  const since = isReady
    ? (order.readyAt ?? order.createdAt)
    : (order.preparingStartedAt ?? order.createdAt);
  const mins = elapsedMinutes(since, now);
  const prepTone = elapsedTone(mins, KITCHEN_WARN_MIN, KITCHEN_ALERT_MIN);
  const readyLate = isReady && mins >= READY_WAIT_ALERT_MINUTES;

  return (
    <SheetHeader className="gap-3 border-b p-5 pr-14">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SheetTitle className="flex flex-wrap items-center gap-3 font-mono text-5xl font-bold leading-none sm:text-6xl">
            #{String(order.dailyNumber).padStart(3, '0')}
            <span
              className="rounded-lg bg-primary/10 px-2 py-1 text-3xl text-primary sm:text-4xl"
              title="Code de retrait"
            >
              {getPickupCode(order.reference)}
            </span>
          </SheetTitle>
          <SheetDescription asChild>
            <p className="mt-3 flex items-center gap-2 text-2xl text-foreground">
              <TypeIcon
                className="h-6 w-6 shrink-0 text-muted-foreground"
                aria-label={typeMeta.label}
              />
              <span className="truncate font-semibold">
                {order.customerName ?? 'Client anonyme'}
              </span>
              {SOURCE_META[order.source] &&
                (() => {
                  const { Icon, label } = SOURCE_META[order.source]!;
                  return (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      {label}
                    </span>
                  );
                })()}
            </p>
          </SheetDescription>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xl font-bold tabular-nums',
            isReady
              ? readyLate
                ? 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100'
                : 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100'
              : TONE_CLASS[prepTone]
          )}
          title={isReady ? 'Prête depuis' : 'Temps écoulé en cuisine'}
        >
          {isReady ? (
            <PackageCheck className="h-5 w-5" />
          ) : (
            <Timer className="h-5 w-5" />
          )}
          {formatElapsed(mins)}
        </span>
      </div>

      {/* Badges : non payé / créneau programmé */}
      {(!order.isPaid || order.pickupTime) && (
        <div className="flex flex-wrap items-center gap-2">
          {!order.isPaid && (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-base font-medium text-orange-900 dark:bg-orange-950 dark:text-orange-100">
              À encaisser après
            </span>
          )}
          {order.pickupTime && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-base font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
              Retrait {formatPickup(order.pickupTime, now)}
            </span>
          )}
        </div>
      )}
    </SheetHeader>
  );
}
