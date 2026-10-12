import { Gift } from 'lucide-react';
import type { CartItem } from '@/lib/cart-store';
import { computeItemsDiscount, getItemGross } from '@/lib/orders/totals';
import type { OrderDetail } from './helpers';

export function OrderTotals({
  items,
  order,
  canSeeMargins,
}: {
  items: CartItem[];
  order: OrderDetail;
  canSeeMargins: boolean;
}) {
  const totalCost = items.reduce((sum, item) => {
    const unitCost = (item.coutMatiere ?? 0) + (item.coutEmballage ?? 0);
    return sum + unitCost * item.quantity;
  }, 0);
  const hasAnyCost = totalCost > 0;
  const grossTotal = items.reduce((sum, item) => sum + getItemGross(item), 0);
  const itemsDiscount = computeItemsDiscount(items);
  const loyaltyDiscount = order.loyaltyDiscount ?? 0;
  const totalDiscount = itemsDiscount + loyaltyDiscount;
  return (
    <>
      {totalDiscount > 0 && (
        <>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Sous-total</span>
            <span>
              {new Intl.NumberFormat('fr-FR').format(grossTotal)} FCFA
            </span>
          </div>
          {itemsDiscount > 0 && (
            <div className="mb-1 flex justify-between text-sm font-medium text-green-700 dark:text-green-400">
              <span>Remise articles</span>
              <span>
                -{new Intl.NumberFormat('fr-FR').format(itemsDiscount)} FCFA
              </span>
            </div>
          )}
          {loyaltyDiscount > 0 && (
            <div className="mb-1 flex items-center justify-between text-sm font-medium text-green-700 dark:text-green-400">
              <span className="inline-flex items-center gap-1">
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                Récompense fidélité
              </span>
              <span>
                -{new Intl.NumberFormat('fr-FR').format(loyaltyDiscount)} FCFA
              </span>
            </div>
          )}
        </>
      )}
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{new Intl.NumberFormat('fr-FR').format(order.total)} FCFA</span>
      </div>
      {canSeeMargins && hasAnyCost && (
        <div className="mt-1 flex justify-between text-sm text-muted-foreground">
          <span>Marge totale</span>
          <span>
            {new Intl.NumberFormat('fr-FR').format(order.total - totalCost)}{' '}
            FCFA ({Math.round(((order.total - totalCost) / order.total) * 100)}
            %)
          </span>
        </div>
      )}
    </>
  );
}
