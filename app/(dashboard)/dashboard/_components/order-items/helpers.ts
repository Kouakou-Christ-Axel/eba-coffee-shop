import { type CartItem, type CartItemSupplement } from '@/lib/cart-store';
import { type Product } from '@/config/menu';

export type PickerState =
  | { mode: 'add'; product: Product }
  | { mode: 'edit'; product: Product; cartId: string }
  | { mode: 'duplicate'; product: Product; cartId: string };

export function makeCartId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function supplementsKey(supplements: CartItemSupplement[]): string {
  return JSON.stringify(
    supplements
      .map(
        (s) => `${s.groupName}:${s.optionName}:${s.price}:${s.quantity ?? 1}`
      )
      .sort()
  );
}

export const fmt = new Intl.NumberFormat('fr-FR');

/** Articles/quantités retirés par rapport au contenu d'origine. */
export function hasRemovedSomething(
  items: CartItem[],
  initialItems: CartItem[]
): boolean {
  const nextByProduct = new Map<string, number>();
  for (const i of items) {
    nextByProduct.set(
      i.productId,
      (nextByProduct.get(i.productId) ?? 0) + i.quantity
    );
  }
  const prevByProduct = new Map<string, number>();
  for (const i of initialItems) {
    prevByProduct.set(
      i.productId,
      (prevByProduct.get(i.productId) ?? 0) + i.quantity
    );
  }
  for (const [productId, before] of prevByProduct) {
    if ((nextByProduct.get(productId) ?? 0) < before) return true;
  }
  return false;
}
