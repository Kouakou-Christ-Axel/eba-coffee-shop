'use client';

import { CheckCheck, ChefHat, X } from 'lucide-react';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { EncaisserButton } from '../../../_components/encaisser-button';
import type { RowState } from './row-state';
import type { RowCallbacks } from './types';

export function RowActions({
  order,
  state,
  pending,
  onRetrieve,
  onStartPreparation,
  onCancel,
  action,
}: Omit<RowCallbacks, 'onExpand'> & {
  order: PreparationOrder;
  state: RowState;
  pending: boolean;
}) {
  const { isReady, isToPay, awaitingLaunch } = state;
  return (
    <>
      {awaitingLaunch && onStartPreparation && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onStartPreparation(order.id)}
            disabled={pending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-base font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:opacity-50"
          >
            <ChefHat className="h-4 w-4" strokeWidth={2.5} />
            {order.stockHold && order.stockHold.state !== 'full'
              ? 'Lancer (stock incomplet)'
              : 'Lancer la préparation'}
          </button>
        </div>
      )}

      {isReady && (
        <div className="flex items-center gap-2 px-4 pb-4">
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              disabled={pending}
              aria-label="Annuler"
              className="flex shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
          <TrackingLinkButton orderId={order.id} className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={() => onRetrieve(order.id)}
            disabled={pending}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2.5} />
            Récupérée
          </button>
        </div>
      )}

      {isToPay && action && (
        <div className="flex items-center gap-2 px-4 pb-4">
          {onCancel && (
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              disabled={pending}
              aria-label="Annuler"
              className="flex shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
          <EncaisserButton
            orderId={order.id}
            orderRef={order.reference}
            amount={order.total - order.depositPaid}
            action={action}
            size="default"
            className="flex-1"
          />
        </div>
      )}

      {/* Récupération anticipée (commande déjà en cuisine mais programmée
          loin) : discrète, le geste normal reste « Lancer »/« Prête ». */}
      {!isReady && order.status === 'PREPARING' && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => onRetrieve(order.id)}
            disabled={pending}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
            Marquer récupérée
          </button>
        </div>
      )}
    </>
  );
}
