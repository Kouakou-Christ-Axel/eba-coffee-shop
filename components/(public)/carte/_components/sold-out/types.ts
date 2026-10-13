import type { CartItemDraft } from '@/lib/cart-store';

export type ReplaceHandler = (
  cartId: string,
  item: CartItemDraft,
  quantity: number,
  maxQuantity: number | undefined
) => void;
