'use client';

import { StickyNote } from 'lucide-react';
import { aggregateOrderSupplements } from '@/lib/orders/format';
import type { PreparationOrder } from '@/lib/preparation-queue';

export function OrderDetailContent({ order }: { order: PreparationOrder }) {
  const supplementLines = aggregateOrderSupplements(order.items);

  return (
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
          </li>
        ))}
      </ul>

      {/* Zone Suppléments : séparée des articles, fusionnée par produit +
            jeu de suppléments avec quantité totale explicite (voir
            aggregateOrderSupplements) pour ne jamais lire "1" là où il y en
            a 2. */}
      {supplementLines.length > 0 && (
        <div className="mt-4 rounded-xl border border-secondary-200 bg-secondary-50/60 p-4 dark:border-secondary-900 dark:bg-secondary-950/20">
          <p className="text-sm font-bold uppercase tracking-wide text-secondary-700 dark:text-secondary-300">
            Suppléments
          </p>
          <ul className="mt-2 space-y-2">
            {supplementLines.map((line) => (
              <li key={line.key} className="text-lg">
                <span className="font-bold">
                  {line.productName}
                  {line.quantity > 1 ? ` ×${line.quantity}` : ''}
                </span>{' '}
                <span className="font-semibold text-secondary-700 dark:text-secondary-300">
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
    </div>
  );
}
