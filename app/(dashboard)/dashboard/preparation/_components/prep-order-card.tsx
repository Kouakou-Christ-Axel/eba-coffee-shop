'use client';

import { formatAbidjanTime } from '@/lib/timezone';
import {
  Bike,
  Check,
  ChefHat,
  Coffee,
  Maximize2,
  ShoppingBag,
  StickyNote,
  Timer,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { OrderType } from '@/generated/prisma/client';
import {
  elapsedMinutes,
  elapsedTone,
  formatElapsed,
  KITCHEN_ALERT_MIN,
  KITCHEN_WARN_MIN,
  TONE_CLASS,
} from './elapsed';

export const ORDER_TYPE_META: Record<
  OrderType,
  { label: string; Icon: typeof Bike }
> = {
  DELIVERY: { label: 'Livraison', Icon: Bike },
  DINE_IN: { label: 'Sur place', Icon: Coffee },
  TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
};

type Props = {
  order: PreparationOrder;
  now: Date;
  pending: boolean;
  onExpand: (id: string) => void;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
};

export function PrepOrderCard({
  order,
  now,
  pending,
  onExpand,
  onReady,
  onCancel,
  onRequestDriver,
}: Props) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const isDelivery = order.orderType === 'DELIVERY';
  // Chrono « en cuisine depuis X » : depuis l'entrée en cuisine, repli createdAt
  // pour les commandes antérieures à la colonne preparingStartedAt.
  const since = order.preparingStartedAt ?? order.createdAt;
  const mins = elapsedMinutes(since, now);
  const tone = elapsedTone(mins, KITCHEN_WARN_MIN, KITCHEN_ALERT_MIN);

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border-2 bg-card shadow-sm',
        tone === 'alert'
          ? 'border-red-300 dark:border-red-800'
          : tone === 'warn'
            ? 'border-amber-300 dark:border-amber-800'
            : 'border-border'
      )}
    >
      {/* Corps tactile : toucher pour agrandir la commande dans un bottom sheet
          lisible de loin. Les boutons d'action vivent hors de cette zone. */}
      <button
        type="button"
        onClick={() => onExpand(order.id)}
        aria-label={`Agrandir la commande #${String(order.dailyNumber).padStart(3, '0')}`}
        className="flex flex-1 cursor-pointer flex-col gap-2 rounded-t-2xl p-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        {/* En-tête : n° + code retrait + chrono */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-mono text-xl font-bold leading-none">
              #{String(order.dailyNumber).padStart(3, '0')}
              <span
                className="rounded bg-primary/10 px-1.5 text-base text-primary"
                title="Code de retrait"
              >
                {getPickupCode(order.reference)}
              </span>
              <Maximize2
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm">
              <TypeIcon
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-label={typeMeta.label}
              />
              <span className="truncate font-medium">
                {order.customerName ?? 'Client anonyme'}
              </span>
            </p>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold tabular-nums',
              TONE_CLASS[tone]
            )}
            title="Temps écoulé en cuisine"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatElapsed(mins)}
          </span>
        </div>

        {/* Badges : non payé / créneau programmé */}
        {(!order.isPaid || order.pickupTime) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {!order.isPaid && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-900 dark:bg-orange-950 dark:text-orange-100">
                À encaisser après
              </span>
            )}
            {order.pickupTime && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
                Retrait {formatAbidjanTime(order.pickupTime)}
              </span>
            )}
          </div>
        )}

        {/* Note client */}
        {order.note && (
          <div className="flex items-start gap-1.5 rounded-lg border-l-2 border-amber-500 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{order.note}</span>
          </div>
        )}

        {/* Articles */}
        <ul className="space-y-1.5">
          {order.items.map((item) => (
            <li key={item.cartId} className="text-base leading-tight">
              <span className="flex items-baseline gap-1.5">
                <span className="font-bold tabular-nums text-primary">
                  ×{item.quantity}
                </span>
                <span className="font-medium">{item.productName}</span>
                {item.addedLater && (
                  <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-bold uppercase text-red-900 dark:bg-red-950 dark:text-red-100">
                    Ajout
                  </span>
                )}
              </span>
              {item.supplements.length > 0 && (
                <span className="block pl-5 text-xs text-muted-foreground">
                  {item.supplements.map(formatSupplementLabel).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </button>

      {/* Demander le livreur (livraison) — hors de la zone tactile d'agrandissement */}
      {isDelivery && (
        <div className="px-3 pb-1">
          <button
            type="button"
            onClick={() => onRequestDriver(order.id)}
            disabled={pending || order.driverRequested}
            className={cn(
              'flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
              order.driverRequested
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
            )}
          >
            <Bike className="h-3.5 w-3.5" />
            {order.driverRequested ? 'Livreur demandé' : 'Demander le livreur'}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-[1fr_2.5fr] gap-2 border-t p-2">
        <button
          type="button"
          onClick={() => onCancel(order.id)}
          disabled={pending}
          aria-label="Annuler"
          className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => onReady(order.id)}
          disabled={pending}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
        >
          {pending ? (
            <ChefHat className="h-5 w-5 animate-pulse" />
          ) : (
            <Check className="h-5 w-5" strokeWidth={3} />
          )}
          Prête
        </button>
      </div>
    </article>
  );
}
