import { Chip } from '@heroui/react';
import type { PublicOrderView } from '@/lib/orders';
import { formatSupplementsSummary } from '@/lib/orders/format';
import { getItemGross } from '@/lib/orders/totals';
import { priceFormatter } from '@/config/menu';

export function OrderItemsSection({ order }: { order: PublicOrderView }) {
  return (
    <div className="w-full">
      <h2 className="mb-3 text-sm font-semibold">Articles</h2>
      <div className="flex flex-col gap-2">
        {order.items.map((item, i) => {
          const unavailable = !order.isPaid && !item.available;
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                {/* `div` et non `p` : le Chip rend un <div>, interdit dans un
                      <p> — l'hydratation échouait dès qu'un article était
                      indisponible, et les premiers clics étaient perdus. */}
                <div className="font-medium">
                  {item.productName}{' '}
                  <span className="text-foreground/50">x{item.quantity}</span>
                  {unavailable && (
                    <Chip
                      color="warning"
                      variant="flat"
                      size="sm"
                      className="ml-2 align-middle"
                    >
                      Indisponible
                    </Chip>
                  )}
                </div>
                {item.supplements.length > 0 && (
                  <p className="text-xs text-foreground/50">
                    {formatSupplementsSummary(item.supplements)}
                  </p>
                )}
              </div>
              <p className="shrink-0 font-medium">
                {priceFormatter.format(getItemGross(item))}&nbsp;FCFA
              </p>
            </div>
          );
        })}
      </div>

      {/* Somme des articles − récompense = Total (réconciliation visible). */}
      {order.loyaltyDiscount != null && order.loyaltyDiscount > 0 && (
        <div className="mt-4 flex justify-between border-t border-foreground/10 pt-4 text-sm">
          <span className="text-foreground/60">Récompense fidélité 🎁</span>
          <span className="font-medium text-primary">
            −{priceFormatter.format(order.loyaltyDiscount)}&nbsp;FCFA
          </span>
        </div>
      )}

      <div className="mt-4 flex justify-between border-t border-foreground/10 pt-4 font-semibold">
        <span>Total</span>
        <span className="text-primary">
          {priceFormatter.format(order.total)}&nbsp;FCFA
        </span>
      </div>

      {order.note && (
        <p className="mt-3 text-xs text-foreground/60">
          <span className="font-semibold">Note&nbsp;:</span> {order.note}
        </p>
      )}
    </div>
  );
}
