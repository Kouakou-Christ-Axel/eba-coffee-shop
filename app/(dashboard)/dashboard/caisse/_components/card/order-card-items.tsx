'use client';

import { Gift } from 'lucide-react';
import { type CashierOrder } from '@/lib/cashier-queue';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel } from '@/lib/orders/format';
import { priceFormatter } from './format';

export function OrderCardItems({ order }: { order: CashierOrder }) {
  return (
    <>
      {/* Détail des articles (avec options choisies) + total */}
      <div className="mt-3 text-sm">
        <ul className="space-y-1.5">
          {order.items.map((item) => {
            const gross = getItemGross(item);
            const net = getItemNet(item);
            const discounted = gross !== net;
            return (
              <li key={item.cartId} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-foreground">
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 px-1.5 text-sm font-bold tabular-nums text-primary">
                      {item.quantity}×
                    </span>
                    <span className="font-medium">{item.productName}</span>
                    {item.addedLater && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Ajout
                      </span>
                    )}
                  </span>
                  {item.supplements.length > 0 && (
                    <div className="pl-8">
                      {item.supplements.map((s) => (
                        <span
                          key={`${s.groupName}:${s.optionName}`}
                          className="block text-xs text-muted-foreground"
                        >
                          + {formatSupplementLabel(s)}
                        </span>
                      ))}
                    </div>
                  )}
                  {discounted && (
                    <span className="block pl-8 text-xs font-medium text-green-700 dark:text-green-400">
                      Remise -{priceFormatter.format(gross - net)} F
                      {item.discountReason ? ` (${item.discountReason})` : ''}
                    </span>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">
                  {discounted && (
                    <span className="mr-1 text-xs text-muted-foreground line-through">
                      {priceFormatter.format(gross)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {priceFormatter.format(net)} F
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {/* Récompense fidélité : mention distincte des remises par article. */}
        {order.loyaltyDiscount != null && order.loyaltyDiscount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800 ring-1 ring-green-200 dark:bg-green-950/40 dark:text-green-200 dark:ring-green-800">
            <span className="inline-flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Récompense fidélité appliquée
            </span>
            <span className="shrink-0 tabular-nums">
              -{priceFormatter.format(order.loyaltyDiscount)} F
            </span>
          </div>
        )}
        <p className="mt-2 border-t pt-2 text-right font-semibold tabular-nums">
          {priceFormatter.format(order.total)} F
        </p>
      </div>
    </>
  );
}
