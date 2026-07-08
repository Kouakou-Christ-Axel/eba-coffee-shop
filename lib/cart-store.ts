// lib/cart-store.ts
import { create } from 'zustand';
import { getItemNet } from '@/lib/orders/totals';

export type CartItemSupplement = {
  groupName: string;
  optionName: string;
  price: number;
  // Nombre de fois où cette option est choisie (groupe type 'quantity').
  // Absent = 1 (choix 'single'/'multiple' classiques).
  quantity?: number;
};

export type CartItem = {
  cartId: string;
  productId: string;
  productName: string;
  basePrice: number;
  coutMatiere: number;
  coutEmballage: number;
  quantity: number;
  supplements: CartItemSupplement[];
  // Ligne ajoutée après la création de la commande (badge « Ajout » côté
  // caisse / cuisine). Absent/false pour les articles d'origine.
  addedLater?: boolean;
  // Remise caisse : montant fixe en FCFA retiré de la ligne (plafonnée), avec
  // motif optionnel. Absent = pas de remise.
  discount?: number;
  discountReason?: string | null;
};

/** Total net d'une ligne (après remise). Voir lib/orders/totals.ts. */
export function getItemTotal(item: CartItem): number {
  return getItemNet(item);
}

type CartStore = {
  items: CartItem[];
  /**
   * `maxQuantity` : garde-fou UI (avancé/conseillé, pas une vérité serveur —
   * la truth finale reste le stock au PAIEMENT, voir lib/order-mutations.ts).
   * Plafonne la quantité de CETTE ligne (produit + suppléments identiques) ;
   * absent/`null` = illimité. Un produit en pause ou épuisé (stock 0) ne doit
   * simplement pas être proposé par l'appelant (product-card/supplement-modal
   * désactivent déjà l'ajout dans ce cas).
   */
  addItem: (
    item: Omit<CartItem, 'cartId' | 'quantity'>,
    maxQuantity?: number | null
  ) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
};

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item, maxQuantity) =>
    set((state) => {
      const cap = maxQuantity ?? Infinity;
      const existing = state.items.find(
        (i) =>
          i.productId === item.productId &&
          JSON.stringify(i.supplements) === JSON.stringify(item.supplements)
      );
      if (existing) {
        const nextQuantity = Math.min(existing.quantity + 1, cap);
        if (nextQuantity <= existing.quantity) return state;
        return {
          items: state.items.map((i) =>
            i.cartId === existing.cartId ? { ...i, quantity: nextQuantity } : i
          ),
        };
      }
      if (cap <= 0) return state;
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
