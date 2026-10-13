import { Button } from '@heroui/react';
import { Copy, Minus, Plus, Trash2 } from 'lucide-react';
import { getItemTotal, type CartItem } from '@/lib/cart-store';
import { priceFormatter } from '@/config/menu';
import { formatSupplementLabel } from '@/lib/orders/format';
import { CartLineStatusChip } from '../cart-line-status';
import { ProductMedia } from '../product-media';
import type { CartDrawerState } from './use-cart-drawer';

export function CartLine({
  item,
  cart,
}: {
  item: CartItem;
  cart: CartDrawerState;
}) {
  const product = cart.findProduct(item.productId);

  return (
    <div className="flex items-start gap-3 py-4 first:pt-0">
      {/* Absent tant que /api/menu n'a pas répondu : ligne purement textuelle. */}
      {product && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          <ProductMedia
            product={product}
            sizes="64px"
            monogramClassName="text-2xl"
          />
        </div>
      )}

      {/* Nom, prix et commandes dans UNE colonne : à 390 px, une troisième
          colonne cassait le lien « autres options » sur trois lignes. */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {item.productName}
            </p>
            {item.supplements.length > 0 && (
              <p className="mt-0.5 text-xs text-foreground/45">
                {item.supplements.map(formatSupplementLabel).join(', ')}
              </p>
            )}
            <CartLineStatusChip
              status={cart.availability?.status[item.cartId]}
            />
            <p className="mt-1 text-sm font-medium text-primary">
              {priceFormatter.format(getItemTotal(item))}
              &nbsp;F
            </p>
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="full"
            color="danger"
            aria-label={`Supprimer ${item.productName}`}
            onPress={() => cart.removeLine(item)}
            className="shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              radius="full"
              aria-label={`Retirer un ${item.productName}`}
              onPress={() => cart.decrementLine(item)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-6 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              radius="full"
              aria-label={`Ajouter un ${item.productName}`}
              onPress={() =>
                cart.updateQuantity(item.cartId, item.quantity + 1)
              }
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {cart.hasOptions(item.productId) && (
            <button
              type="button"
              onClick={() => cart.setDuplicateItem(item)}
              className="inline-flex min-w-0 cursor-pointer items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-foreground"
            >
              <Copy className="h-3 w-3 shrink-0" />
              <span className="truncate">Autres options</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
