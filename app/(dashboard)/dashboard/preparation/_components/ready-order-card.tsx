'use client';

import { Bike, Coffee, PackageCheck, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { OrderType } from '@/generated/prisma/client';
import { elapsedMinutes, formatElapsed } from './elapsed';

const TYPE_ICON: Record<OrderType, typeof Bike> = {
  DELIVERY: Bike,
  DINE_IN: Coffee,
  TAKEAWAY: ShoppingBag,
};

type Props = {
  order: PreparationOrder;
  now: Date;
};

/**
 * Carte compacte d'une commande prête (READY) : sert à emballer et à repérer le
 * code de retrait. Minuteur « prête depuis X » (rouge quand le client tarde) et
 * lien de suivi pour relancer le client / son livreur.
 */
export function ReadyOrderCard({ order, now }: Props) {
  const TypeIcon = TYPE_ICON[order.orderType];
  const since = order.readyAt ?? order.createdAt;
  const mins = elapsedMinutes(since, now);
  const late = mins >= READY_WAIT_ALERT_MINUTES;

  return (
    <article
      className={cn(
        'flex flex-col gap-2 rounded-xl border-2 bg-card p-3 shadow-sm',
        late
          ? 'border-red-300 dark:border-red-800'
          : 'border-green-300 dark:border-green-800'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5 font-mono text-lg font-bold leading-none">
            #{String(order.dailyNumber).padStart(3, '0')}
            <span
              className="rounded bg-primary/10 px-1.5 text-base text-primary"
              title="Code de retrait"
            >
              {getPickupCode(order.reference)}
            </span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <TypeIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">
              {order.customerName ?? 'Client anonyme'}
            </span>
          </p>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold tabular-nums',
            late
              ? 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100'
              : 'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100'
          )}
          title="Prête depuis"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          {formatElapsed(mins)}
        </span>
      </div>

      {/* Récap articles compact (pour emballer) */}
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {order.items.map((item) => (
          <li key={item.cartId} className="leading-tight">
            <span className="font-medium text-foreground">
              {item.quantity}× {item.productName}
            </span>
            {item.supplements.length > 0 && (
              <span>
                {' '}
                · {item.supplements.map(formatSupplementLabel).join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>

      {late && (
        <p className="text-xs font-semibold text-red-700 dark:text-red-300">
          Le client tarde — relancer via le lien de suivi
        </p>
      )}

      <TrackingLinkButton orderId={order.id} />
    </article>
  );
}
