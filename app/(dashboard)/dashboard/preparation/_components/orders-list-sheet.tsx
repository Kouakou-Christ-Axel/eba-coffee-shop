'use client';

import { CalendarClock, PackageCheck } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { formatPickup } from '@/lib/orders/scheduling';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { ORDER_TYPE_META } from './prep-order-card';
import { elapsedMinutes, formatElapsed } from './elapsed';

export type OrdersListVariant = 'scheduled' | 'ready';

const VARIANT_META: Record<
  OrdersListVariant,
  { title: string; description: string; Icon: typeof CalendarClock }
> = {
  scheduled: {
    title: 'Commandes programmées',
    description: 'Retrait encore lointain — pas encore à cuisiner',
    Icon: CalendarClock,
  },
  ready: {
    title: 'Prêtes à récupérer',
    description: 'Emballer et remettre au client (code de retrait)',
    Icon: PackageCheck,
  },
};

type Props = {
  variant: OrdersListVariant;
  orders: PreparationOrder[];
  now: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpand: (id: string) => void;
};

/**
 * Bottom sheet listant les commandes qui ne sont PAS dans le travail courant :
 *   - `scheduled` : programmées à retrait lointain (déchargées de la grille).
 *   - `ready`     : prêtes en attente de récupération (emballage + codes).
 * Chaque ligne est tactile → ouvre le bottom sheet de détail lisible.
 */
export function OrdersListSheet({
  variant,
  orders,
  now,
  open,
  onOpenChange,
  onExpand,
}: Props) {
  const meta = VARIANT_META[variant];
  const Icon = meta.Icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[60vh] max-h-[85vh] gap-0 rounded-t-3xl p-0"
      >
        <SheetHeader className="border-b p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-5 w-5" />
            {meta.title} ({orders.length})
          </SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {variant === 'scheduled'
                ? 'Aucune commande programmée.'
                : 'Aucune commande prête pour l’instant.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => (
                <OrdersListRow
                  key={order.id}
                  variant={variant}
                  order={order}
                  now={now}
                  onExpand={onExpand}
                />
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OrdersListRow({
  variant,
  order,
  now,
  onExpand,
}: {
  variant: OrdersListVariant;
  order: PreparationOrder;
  now: Date;
  onExpand: (id: string) => void;
}) {
  const TypeIcon = ORDER_TYPE_META[order.orderType].Icon;
  const isReady = variant === 'ready';
  const since = isReady
    ? (order.readyAt ?? order.createdAt)
    : (order.preparingStartedAt ?? order.createdAt);
  const mins = elapsedMinutes(since, now);
  const readyLate = isReady && mins >= READY_WAIT_ALERT_MINUTES;

  return (
    <li
      className={cn(
        'rounded-2xl border-2 bg-card shadow-sm',
        isReady
          ? readyLate
            ? 'border-red-300 dark:border-red-800'
            : 'border-green-300 dark:border-green-800'
          : 'border-border'
      )}
    >
      <button
        type="button"
        onClick={() => onExpand(order.id)}
        aria-label={`Agrandir la commande #${String(order.dailyNumber).padStart(3, '0')}`}
        className="flex w-full flex-col gap-1.5 rounded-t-2xl p-4 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="flex flex-wrap items-center gap-2 font-mono text-2xl font-bold leading-none">
            #{String(order.dailyNumber).padStart(3, '0')}
            <span
              className="rounded bg-primary/10 px-1.5 py-0.5 text-lg text-primary"
              title="Code de retrait"
            >
              {getPickupCode(order.reference)}
            </span>
          </p>
          {isReady ? (
            <span
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-base font-bold tabular-nums',
                readyLate
                  ? 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100'
                  : 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100'
              )}
              title="Prête depuis"
            >
              <PackageCheck className="h-4 w-4" />
              {formatElapsed(mins)}
            </span>
          ) : (
            order.pickupTime && (
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-100 px-2.5 py-1 text-base font-bold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                title="Créneau de retrait"
              >
                <CalendarClock className="h-4 w-4" />
                {formatPickup(order.pickupTime, now)}
              </span>
            )
          )}
        </div>

        <p className="flex items-center gap-2 text-base text-muted-foreground">
          <TypeIcon className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium text-foreground">
            {order.customerName ?? 'Client anonyme'}
          </span>
        </p>

        <ul className="text-base leading-snug">
          {order.items.map((item) => (
            <li key={item.cartId}>
              <span className="font-semibold text-foreground">
                {item.quantity}× {item.productName}
              </span>
              {item.supplements.length > 0 && (
                <span className="text-muted-foreground">
                  {' · '}
                  {item.supplements.map(formatSupplementLabel).join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>

        {readyLate && (
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Le client tarde — relancer via le lien de suivi
          </p>
        )}
      </button>

      {isReady && (
        <div className="px-4 pb-4">
          <TrackingLinkButton orderId={order.id} />
        </div>
      )}
    </li>
  );
}
