import type { Product } from '@/config/menu';
import type { CartItem, CartItemSupplement } from '@/lib/cart-store';

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

/** Ajoute un exemplaire : fusionne avec la ligne de même produit et mêmes suppléments. */
export function addItem(
  prev: CartItem[],
  product: Product,
  supplements: CartItemSupplement[]
): CartItem[] {
  const key = supplementsKey(supplements);
  const existing = prev.find(
    (i) => i.productId === product.id && supplementsKey(i.supplements) === key
  );
  if (existing) {
    return prev.map((i) =>
      i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
    );
  }
  const item: CartItem = {
    cartId: makeCartId(),
    productId: product.id,
    productName: product.name,
    basePrice: product.price,
    coutMatiere: product.coutMatiere ?? 0,
    coutEmballage: product.coutEmballage ?? 0,
    quantity: 1,
    supplements,
    advanceOrderDays: product.advanceOrderDays,
    requiresDeposit: product.requiresDeposit,
  };
  return [...prev, item];
}

/** Quantité <= 0 : la ligne est retirée. */
export function setItemQuantity(
  prev: CartItem[],
  cartId: string,
  quantity: number
): CartItem[] {
  return quantity <= 0
    ? prev.filter((i) => i.cartId !== cartId)
    : prev.map((i) => (i.cartId === cartId ? { ...i, quantity } : i));
}

export function removeItem(prev: CartItem[], cartId: string): CartItem[] {
  return prev.filter((i) => i.cartId !== cartId);
}

export function setItemDiscount(
  prev: CartItem[],
  cartId: string,
  discount: number,
  reason: string | null
): CartItem[] {
  return prev.map((i) =>
    i.cartId === cartId ? { ...i, discount, discountReason: reason } : i
  );
}
