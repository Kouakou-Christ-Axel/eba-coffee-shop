'use client';

import { ChefHat, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { OrdersListRow } from './orders-list/orders-list-row';

type Props = {
  ready: PreparationOrder[];
  waiting: PreparationOrder[];
  urgent: boolean;
  lateWaiting: boolean;
  now: Date;
  pendingIds: Set<string>;
  isPending: boolean;
  onExpand: (id: string) => void;
  onRetrieve: (id: string) => void;
  onCancel: (id: string) => void;
  onStartPreparation: (id: string) => void;
  onStartMany: (ids: string[]) => void;
};

/**
 * En tête de page : les programmées PAYÉES du jour pas encore lancées. « Prêtes à
 * lancer » = tout leur stock est déjà réservé (un tap suffit, rien à décompter de
 * plus) ; « En attente de stock » = au moins un produit n'est pas encore arrivé.
 * Visible même quand la grille « à cuisiner » est vide : c'est précisément alors
 * qu'on les oublie.
 */
export function ToLaunchSection({
  ready,
  waiting,
  urgent,
  lateWaiting,
  now,
  pendingIds,
  isPending,
  onExpand,
  onRetrieve,
  onCancel,
  onStartPreparation,
  onStartMany,
}: Props) {
  if (ready.length === 0 && waiting.length === 0) return null;

  const row = (order: PreparationOrder) => (
    <OrdersListRow
      key={order.id}
      variant="scheduled"
      order={order}
      now={now}
      onExpand={onExpand}
      pending={pendingIds.has(order.id)}
      onRetrieve={onRetrieve}
      onStartPreparation={onStartPreparation}
      onCancel={onCancel}
    />
  );

  return (
    <section
      aria-label="Programmées à lancer aujourd’hui"
      className="space-y-4"
    >
      {ready.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border-2 p-4',
            urgent
              ? 'border-red-400 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20'
              : 'border-green-400 bg-green-50/60 dark:border-green-800 dark:bg-green-950/20'
          )}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ChefHat className="h-5 w-5" aria-hidden="true" />
              Prêtes à lancer ({ready.length})
              {urgent && (
                <span className="text-sm text-red-700 dark:text-red-300">
                  · retrait dans moins de 30 min
                </span>
              )}
            </h2>
            {ready.length > 1 && (
              <button
                type="button"
                onClick={() => onStartMany(ready.map((o) => o.id))}
                disabled={isPending}
                className="flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <ChefHat className="h-4 w-4" strokeWidth={2.5} />
                Tout lancer ({ready.length})
              </button>
            )}
          </div>
          <ul className="grid gap-3 md:grid-cols-2">{ready.map(row)}</ul>
        </div>
      )}

      {waiting.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border-2 p-4',
            lateWaiting
              ? 'border-red-400 bg-red-50/60 dark:border-red-800 dark:bg-red-950/20'
              : 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
          )}
        >
          <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-bold">
            <Hourglass className="h-5 w-5" aria-hidden="true" />
            En attente de stock ({waiting.length})
            {lateWaiting && (
              <span className="text-sm text-red-700 dark:text-red-300">
                · retrait dans moins de 30 min : produire ou prévenir le client
              </span>
            )}
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">{waiting.map(row)}</ul>
        </div>
      )}
    </section>
  );
}
