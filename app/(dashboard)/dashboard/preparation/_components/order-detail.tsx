'use client';

import {
  format,
  formatDistanceToNowStrict,
  isPast,
  differenceInMinutes,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bike,
  Check,
  Clock,
  Coffee,
  Phone,
  ShoppingBag,
  StickyNote,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { getItemNet } from '@/lib/orders/totals';
import type { OrderType } from '@/generated/prisma/client';

const ORDER_TYPE_META: Record<OrderType, { label: string; Icon: typeof Bike }> =
  {
    DELIVERY: { label: 'Livraison', Icon: Bike },
    DINE_IN: { label: 'Sur place', Icon: Coffee },
    TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
  };

const priceFormatter = new Intl.NumberFormat('fr-FR');

type Props = {
  order: PreparationOrder;
  isPending: boolean;
  onReady: () => void;
  onCancel: () => void;
  onRequestDriver: () => void;
};

export function OrderDetail({
  order,
  isPending,
  onReady,
  onCancel,
  onRequestDriver,
}: Props) {
  const pickup = order.pickupTime;
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const isDelivery = order.orderType === 'DELIVERY';
  const minutesUntil = pickup ? differenceInMinutes(pickup, new Date()) : null;
  const isLate = pickup ? isPast(pickup) : false;
  const isSoon = pickup ? !isLate && (minutesUntil ?? 0) <= 15 : false;

  const pickupRelative = pickup
    ? isLate
      ? `En retard de ${formatDistanceToNowStrict(pickup, { locale: fr })}`
      : `Dans ${formatDistanceToNowStrict(pickup, { locale: fr })}`
    : 'Walk-in';

  return (
    <>
      <div className="flex-1 py-2">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight">
              #{String(order.dailyNumber).padStart(3, '0')}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {order.reference}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                title={typeMeta.label}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </span>
              {!order.isPaid && (
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-900 dark:bg-orange-950 dark:text-orange-100">
                  À encaisser après
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-semibold">
              {order.customerName ?? 'Client anonyme'}
            </p>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="mt-1 inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4" />
                {order.customerPhone}
              </a>
            )}
          </div>

          <div
            className={cn(
              'flex flex-col items-end rounded-xl px-5 py-3',
              isLate
                ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100'
                : isSoon
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                  : 'bg-muted'
            )}
          >
            <div className="flex items-center gap-2 text-4xl font-bold tabular-nums">
              <Clock className="h-7 w-7" />
              {pickup ? format(pickup, 'HH:mm', { locale: fr }) : '—'}
            </div>
            <p className="mt-1 text-sm font-medium">{pickupRelative}</p>
          </div>
        </div>

        {order.note && (
          <div className="mb-6 flex gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
            <StickyNote className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="text-base font-medium text-amber-900 dark:text-amber-100">
              {order.note}
            </p>
          </div>
        )}

        {isDelivery && (
          <div className="mb-6">
            <button
              type="button"
              onClick={onRequestDriver}
              disabled={isPending || order.driverRequested}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 text-base font-semibold transition-colors',
                order.driverRequested
                  ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
              )}
            >
              <Bike className="h-5 w-5" />
              {order.driverRequested
                ? 'Livreur demandé · caisse alertée'
                : 'Demander le livreur maintenant'}
            </button>
          </div>
        )}

        <div className="rounded-xl border bg-card">
          <ul className="divide-y">
            {order.items.map((item) => (
              <li key={item.cartId} className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold tabular-nums text-primary">
                      ×{item.quantity}
                    </span>
                    <span className="text-2xl font-semibold">
                      {item.productName}
                    </span>
                    {item.addedLater && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-900 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-100 dark:ring-red-800">
                        Ajout
                      </span>
                    )}
                  </div>
                  <span className="text-base text-muted-foreground">
                    {priceFormatter.format(getItemNet(item))} FCFA
                  </span>
                </div>
                {item.supplements.length > 0 && (
                  <ul className="mt-2 ml-12 space-y-1">
                    {item.supplements.map((sup, i) => (
                      <li
                        key={i}
                        className="text-lg text-muted-foreground before:mr-2 before:content-['•']"
                      >
                        <span className="font-medium text-foreground">
                          {sup.optionName}
                        </span>
                        <span className="text-sm"> ({sup.groupName})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t bg-muted/30 px-5 py-4">
            <span className="text-lg font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </span>
            <span className="text-3xl font-bold tabular-nums">
              {priceFormatter.format(order.total)}{' '}
              <span className="text-xl text-muted-foreground">FCFA</span>
            </span>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 grid grid-cols-[1fr_3fr] gap-3 border-t bg-background pt-4 pb-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-200 bg-red-50 py-6 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/40"
        >
          <X className="h-8 w-8" strokeWidth={2.5} />
          <span className="text-lg font-bold">Annuler</span>
        </button>
        <button
          type="button"
          onClick={onReady}
          disabled={isPending}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-600 py-6 text-white shadow-lg transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
        >
          <Check className="h-10 w-10" strokeWidth={3} />
          <span className="text-2xl font-bold">Commande prête</span>
        </button>
      </div>
    </>
  );
}
