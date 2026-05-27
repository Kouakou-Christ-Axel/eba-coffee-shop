// lib/cart-store.ts
import { create } from 'zustand';

export type CartItemSupplement = {
  groupName: string;
  optionName: string;
  price: number;
};

export type CartItem = {
  cartId: string;
  productId: string;
  productName: string;
  basePrice: number;
  quantity: number;
  supplements: CartItemSupplement[];
};

export function getItemTotal(item: CartItem): number {
  const supplementsTotal = item.supplements.reduce(
    (sum, s) => sum + s.price,
    0
  );
  return (item.basePrice + supplementsTotal) * item.quantity;
}

type CartStore = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cartId' | 'quantity'>) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find(
        (i) =>
          i.productId === item.productId &&
          JSON.stringify(i.supplements) === JSON.stringify(item.supplements)
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.cartId === existing.cartId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      const cartId = Math.random().toString(36).slice(2, 10);
      return { items: [...state.items, { ...item, cartId, quantity: 1 }] };
    }),

  removeItem: (cartId) =>
    set((state) => ({
      items: state.items.filter((i) => i.cartId !== cartId),
    })),

  updateQuantity: (cartId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((i) => i.cartId !== cartId)
          : state.items.map((i) =>
              i.cartId === cartId ? { ...i, quantity } : i
            ),
    })),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  totalPrice: () => get().items.reduce((sum, i) => sum + getItemTotal(i), 0),
}));
