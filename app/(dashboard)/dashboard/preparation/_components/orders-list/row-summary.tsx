'use client';

import { CalendarClock, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPickupCode } from '@/lib/orders/format';
import { formatPickup } from '@/lib/orders/scheduling';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { SOURCE_META } from '../prep-order-card';
import { formatElapsed } from '../elapsed';
import type { RowState } from './row-state';

export function RowSummary({
  order,
  now,
  state,
  onExpand,
}: {
  order: PreparationOrder;
  now: Date;
  state: RowState;
  onExpand: (id: string) => void;
}) {
  const {
    TypeIcon,
    isReady,
    isToPay,
    mins,
    readyLate,
    awaitingLaunch,
    launchNow,
    launchToday,
    supplementLines,
  } = state;
  return (
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
        {SOURCE_META[order.source] &&
          (() => {
            const { Icon, label } = SOURCE_META[order.source]!;
            return (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </span>
            );
          })()}
      </p>

      <ul className="text-base leading-snug">
        {order.items.map((item) => (
          <li key={item.cartId}>
            <span className="font-semibold text-foreground">
              {item.quantity}× {item.productName}
            </span>
          </li>
        ))}
      </ul>

      {/* Zone Suppléments : séparée des articles, fusionnée par produit +
            jeu de suppléments avec quantité totale explicite (voir
            aggregateOrderSupplements) pour ne jamais lire "1" là où il y en
            a 2. */}
      {supplementLines.length > 0 && (
        <div className="rounded-lg border border-secondary-200 bg-secondary-50/60 p-2 dark:border-secondary-900 dark:bg-secondary-950/20">
          <p className="text-[11px] font-bold uppercase tracking-wide text-secondary-700 dark:text-secondary-300">
            Suppléments
          </p>
          <ul className="mt-1 space-y-0.5">
            {supplementLines.map((line) => (
              <li key={line.key} className="text-sm">
                <span className="font-semibold">
                  {line.productName}
                  {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                </span>{' '}
                <span className="text-secondary-700 dark:text-secondary-300">
                  {line.supplements
                    .map((s) =>
                      s.quantity > 1
                        ? `${s.optionName} ×${s.quantity}`
                        : s.optionName
                    )
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isToPay && (
        <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
          {(order.total - order.depositPaid).toLocaleString('fr-FR')} F à
          encaisser
        </p>
      )}

      {readyLate && (
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Le client tarde — relancer via le lien de suivi
        </p>
      )}
      {awaitingLaunch && (
        <p
          className={cn(
            'text-sm font-semibold',
            launchNow
              ? 'text-red-700 dark:text-red-300'
              : launchToday
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-muted-foreground'
          )}
        >
          {launchNow
            ? 'À lancer maintenant'
            : launchToday
              ? 'À lancer aujourd’hui — retrait prévu ce jour'
              : 'Pas encore en cuisine — le stock sera décompté au lancement'}
          {!order.isPaid && ' · non encaissée'}
        </p>
      )}
    </button>
  );
}
