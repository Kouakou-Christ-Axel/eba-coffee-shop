'use client';

import { formatAbidjanTime } from '@/lib/timezone';
import { Maximize2, StickyNote, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aggregateOrderSupplements, getPickupCode } from '@/lib/orders/format';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { formatElapsed, TONE_CLASS, type elapsedTone } from '../elapsed';
import { ORDER_TYPE_META, SOURCE_META } from './meta';

export function CardBody({
  order,
  mins,
  tone,
  onExpand,
}: {
  order: PreparationOrder;
  mins: number;
  tone: ReturnType<typeof elapsedTone>;
  onExpand: (id: string) => void;
}) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const supplementLines = aggregateOrderSupplements(order.items);

  return (
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
          </li>
        ))}
      </ul>

      {/* Zone Suppléments : séparée des articles pour ne jamais se perdre
            dans la liste — fusionnée par produit + jeu de suppléments avec
            quantité totale explicite (voir aggregateOrderSupplements). */}
      {supplementLines.length > 0 && (
        <div className="rounded-lg border border-secondary-200 bg-secondary-50/60 p-2 dark:border-secondary-900 dark:bg-secondary-950/20">
          <p className="text-xs font-bold uppercase tracking-wide text-secondary-700 dark:text-secondary-300">
            Suppléments
          </p>
          <ul className="mt-1 space-y-1">
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
    </button>
  );
}
