'use client';

import { StickyNote } from 'lucide-react';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { SupplementBadges } from '../supplement-badges';

export function OrderDetailContent({ order }: { order: PreparationOrder }) {
  return (
    <div className="min-h-32 flex-1 overflow-y-auto p-5">
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
            <div className="pl-12">
              <SupplementBadges supplements={item.supplements} size="lg" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
