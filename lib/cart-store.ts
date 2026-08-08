// lib/cart-store.ts
import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getItemNet } from '@/lib/orders/totals';
import { CART_MAX_AGE_MS } from '@/config/constants';

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
  // Snapshot du délai de commande à l'avance EFFECTIF (produit × catégorie,
  // voir `Product.advanceOrderDays`/`effectiveAdvanceOrderDays`, lib/menu.ts)
  // au moment de l'ajout au panier. Absent/0 = pas de contrainte. Permet au
  // checkout de calculer la date de retrait minimale sans re-fetcher le menu
  // (comme `basePrice`).
  advanceOrderDays?: number;
  // Snapshot du planning récurrent EFFECTIF (`Product.availableDays`, déjà
  // intersecté avec celui de la catégorie — voir `intersectAvailableDays`,
  // lib/menu.ts) au moment de l'ajout au panier. Absent = pas de restriction.
  // Comme `advanceOrderDays`, sert au CONFORT du sélecteur de créneau (voir
  // SlotPicker) — la vérité reste revérifiée côté serveur PAR PRODUIT au
  // paiement (lib/orders/availability.ts), jamais depuis ce snapshot.
  availableDays?: number[];
  // Snapshot des fenêtres « spécialité de la semaine »
  // (`Product.weeklySpecialPeriods`) au moment de l'ajout au panier.
  // Absent/vide = pas de restriction. Même rôle « confort » que
  // `availableDays` ci-dessus.
  weeklySpecialPeriods?: { startDate: string; endDate: string }[];
};

/** Total net d'une ligne (après remise). Voir lib/orders/totals.ts. */
export function getItemTotal(item: CartItem): number {
  return getItemNet(item);
}

// Clé localStorage du panier — même convention que 'eba-push-order'
// (order-notifications.tsx) et 'eba-orders' (lib/order-history.ts).
const CART_STORAGE_KEY = 'eba-cart';

type CartStore = {
  items: CartItem[];
  /**
   * Dernière modification du panier (epoch ms). Sert à péremption : un panier
   * plus vieux que `CART_MAX_AGE_MS` est vidé à la réhydratation (les prix /
   * disponibilités peuvent avoir changé — la vérité stock reste de toute façon
   * le PAIEMENT, voir lib/order-mutations.ts).
   */
  updatedAt: number | null;
  /**
   * Vrai une fois la réhydratation localStorage terminée (ou échouée). Le
   * store démarre vide côté SSR et 1ᵉʳ rendu client (`skipHydration`) : les
   * consommateurs qui redirigent/affichent selon le contenu du panier doivent
   * attendre ce drapeau (voir `useCartHydration`).
   */
  hasHydrated: boolean;
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

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      updatedAt: null,
      hasHydrated: false,

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
                i.cartId === existing.cartId
                  ? { ...i, quantity: nextQuantity }
                  : i
              ),
              updatedAt: Date.now(),
            };
          }
          if (cap <= 0) return state;
          const cartId = Math.random().toString(36).slice(2, 10);
          return {
            items: [...state.items, { ...item, cartId, quantity: 1 }],
            updatedAt: Date.now(),
          };
        }),

      removeItem: (cartId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartId !== cartId),
          updatedAt: Date.now(),
        })),

      updateQuantity: (cartId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.cartId !== cartId)
              : state.items.map((i) =>
                  i.cartId === cartId ? { ...i, quantity } : i
                ),
          updatedAt: Date.now(),
        })),

      clearCart: () => set({ items: [], updatedAt: Date.now() }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + getItemTotal(i), 0),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        updatedAt: state.updatedAt,
      }),
      // Réhydratation explicite (useCartHydration) : pas de mismatch SSR, le
      // serveur et le 1ᵉʳ rendu client voient tous deux un panier vide.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Appelé aussi en cas d'échec (state undefined) : on lève toujours le
        // drapeau pour ne jamais bloquer l'UI sur un localStorage indisponible.
        const stale =
          state?.updatedAt != null &&
          Date.now() - state.updatedAt > CART_MAX_AGE_MS;
        useCartStore.setState({
          hasHydrated: true,
          ...(stale ? { items: [], updatedAt: null } : {}),
        });
      },
    }
  )
);

/**
 * Déclenche la réhydratation du panier depuis localStorage (idempotent) et
 * retourne `true` une fois terminée. À appeler par tout composant qui décide
 * d'un affichage ou d'une redirection selon le contenu du panier.
 */
export function useCartHydration(): boolean {
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return hasHydrated;
}
