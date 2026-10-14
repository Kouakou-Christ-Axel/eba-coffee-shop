'use client';

import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPickupCode } from '@/lib/orders/format';
import { formatPickup, isScheduledAhead } from '@/lib/orders/scheduling';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { CardActions } from './prep-card/card-actions';
import { deriveRowState } from './orders-list/row-state';
import { RowActions } from './orders-list/row-actions';

// Même palette que les pastilles d'onglet de la recherche caisse.
const STATUS_PILL = {
  cooking: {
    label: 'À cuisiner',
    className:
      'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100',
  },
  ready: {
    label: 'Prête',
    className:
      'bg-green-100 text-green-900 dark:bg-green-950/60 dark:text-green-100',
  },
  scheduled: {
    label: 'Programmée',
    className:
      'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100',
  },
} as const;

function statusOf(order: PreparationOrder, now: Date) {
  if (order.status === 'READY') return STATUS_PILL.ready;
  if (order.status === 'PREPARING' && !isScheduledAhead(order, now)) {
    return STATUS_PILL.cooking;
  }
  return STATUS_PILL.scheduled;
}

export type SearchRowCallbacks = {
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRetrieve: (id: string) => void;
  onStartPreparation: (id: string) => void;
};

/**
 * Un résultat de recherche : le résumé (toucher = détail agrandi) ET les gestes
 * de la commande, les mêmes que sur le ticket ou dans la liste « Prêtes » —
 * « Prête » pour ce qui cuit, « Récupérée » pour ce qui attend, « Lancer » pour
 * une programmée. Le staff n'a plus à ouvrir le détail pour agir.
 */
export function SearchResultRow({
  order,
  now,
  pending,
  onSelect,
  onReady,
  onCancel,
  onRetrieve,
  onStartPreparation,
}: SearchRowCallbacks & {
  order: PreparationOrder;
  now: Date;
  pending: boolean;
  onSelect: (id: string) => void;
}) {
  const status = statusOf(order, now);
  const cooking = order.status === 'PREPARING' && !isScheduledAhead(order, now);
  return (
    <li className="rounded-2xl border-2 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => onSelect(order.id)}
        className="flex w-full flex-col gap-1.5 rounded-t-2xl p-4 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xl font-bold leading-none">
            #{String(order.dailyNumber).padStart(3, '0')}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-lg font-bold text-primary">
            {getPickupCode(order.reference)}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold',
              status.className
            )}
          >
            {status.label}
          </span>
          {!order.isPaid && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-950/60 dark:text-orange-100">
              Non payée
            </span>
          )}
        </div>
        <p className="flex items-center justify-between gap-3 text-base">
          <span className="truncate font-medium">
            {order.customerName ?? 'Client anonyme'}
          </span>
          {order.pickupTime && (
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              <CalendarClock className="h-4 w-4" />
              {formatPickup(order.pickupTime, now)}
            </span>
          )}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {order.items
            .map((i) => `${i.quantity}× ${i.productName}`)
            .join(' · ')}
        </p>
      </button>

      {cooking ? (
        // Colonne : `CardActions` est pensé pour un ticket `flex-col` (ses lignes pleine largeur).
        <div className="flex flex-col">
          <CardActions
            orderId={order.id}
            pending={pending}
            onReady={onReady}
            onCancel={onCancel}
            onRetrieve={onRetrieve}
          />
        </div>
      ) : (
        <RowActions
          order={order}
          state={deriveRowState(
            order.status === 'READY' ? 'ready' : 'scheduled',
            order,
            now
          )}
          pending={pending}
          onRetrieve={onRetrieve}
          onStartPreparation={onStartPreparation}
          onCancel={onCancel}
        />
      )}
    </li>
  );
}
