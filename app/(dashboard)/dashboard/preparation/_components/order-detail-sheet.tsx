'use client';

import {
  Bike,
  Check,
  ChefHat,
  PackageCheck,
  StickyNote,
  Timer,
  X,
} from 'lucide-react';
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
import {
  elapsedMinutes,
  elapsedTone,
  formatElapsed,
  KITCHEN_ALERT_MIN,
  KITCHEN_WARN_MIN,
  TONE_CLASS,
} from './elapsed';

type Props = {
  order: PreparationOrder | null;
  now: Date;
  pending: boolean;
  onClose: () => void;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
};

/**
 * Bottom sheet de détail d'UNE commande, pensé pour être lu de loin en cuisine
 * (numéro et articles très grands). Ouvert au toucher d'une carte / d'une ligne
 * de liste. Regroupe aussi les actions (Prête / Annuler / Livreur) en gros
 * boutons tactiles. Pour une commande déjà prête (READY), remplace « Prête » par
 * le lien de suivi.
 */
export function OrderDetailSheet({
  order,
  now,
  pending,
  onClose,
  onReady,
  onCancel,
  onRequestDriver,
}: Props) {
  const open = order !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="h-[70vh] max-h-[85vh] gap-0 rounded-t-3xl p-0"
      >
        {order && (
          <OrderDetailBody
            order={order}
            now={now}
            pending={pending}
            onReady={onReady}
            onCancel={onCancel}
            onRequestDriver={onRequestDriver}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetailBody({
  order,
  now,
  pending,
  onReady,
  onCancel,
  onRequestDriver,
}: {
  order: PreparationOrder;
  now: Date;
  pending: boolean;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
}) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const isDelivery = order.orderType === 'DELIVERY';
  const isReady = order.status === 'READY';

  // Chrono : « en cuisine depuis X » (PREPARING) ou « prête depuis X » (READY).
  const since = isReady
    ? (order.readyAt ?? order.createdAt)
    : (order.preparingStartedAt ?? order.createdAt);
  const mins = elapsedMinutes(since, now);
  const prepTone = elapsedTone(mins, KITCHEN_WARN_MIN, KITCHEN_ALERT_MIN);
  const readyLate = isReady && mins >= READY_WAIT_ALERT_MINUTES;

  return (
    <>
      {/* En-tête fixe : numéro + code, très grand, lisible de loin */}
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

      {/* Corps défilant : note + articles en très grand */}
      <div className="flex-1 overflow-y-auto p-5">
        {order.note && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border-l-4 border-amber-500 bg-amber-50/70 px-4 py-3 text-lg text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <StickyNote className="mt-1 h-5 w-5 shrink-0" />
            <span>{order.note}</span>
          </div>
        )}

        <ul className="space-y-4">
          {order.items.map((item) => (
            <li key={item.cartId} className="leading-tight">
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums text-primary">
                  ×{item.quantity}
                </span>
                <span className="text-2xl font-bold sm:text-3xl">
                  {item.productName}
                </span>
                {item.addedLater && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-sm font-bold uppercase text-red-900 dark:bg-red-950 dark:text-red-100">
                    Ajout
                  </span>
                )}
              </span>
              {item.supplements.length > 0 && (
                <span className="mt-1 block pl-10 text-lg text-muted-foreground">
                  {item.supplements.map(formatSupplementLabel).join(' · ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions fixes en bas */}
      <div className="flex flex-col gap-3 border-t p-4">
        {isDelivery && (
          <button
            type="button"
            onClick={() => onRequestDriver(order.id)}
            disabled={pending || order.driverRequested}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border py-3 text-lg font-semibold transition-colors disabled:opacity-60',
              order.driverRequested
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
            )}
          >
            <Bike className="h-5 w-5" />
            {order.driverRequested ? 'Livreur demandé' : 'Demander le livreur'}
          </button>
        )}

        {isReady ? (
          <TrackingLinkButton orderId={order.id} className="py-1" />
        ) : (
          <div className="grid grid-cols-[1fr_2.5fr] gap-3">
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              disabled={pending}
              aria-label="Annuler"
              className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 py-4 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              <X className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => onReady(order.id)}
              disabled={pending}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-xl font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
            >
              {pending ? (
                <ChefHat className="h-7 w-7 animate-pulse" />
              ) : (
                <Check className="h-7 w-7" strokeWidth={3} />
              )}
              Prête
            </button>
          </div>
        )}
      </div>
    </>
  );
}
