// lib/parked-orders-store.ts
//
// Commandes « mises de côté » à la caisse : le staff range la commande en cours
// de composition, en démarre une autre, puis reprend la première exactement où
// il l'avait laissée. Stockage local à l'appareil (comme `lib/cart-store.ts`).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from '@/lib/cart-store';
import { getItemTotal } from '@/lib/cart-store';
import type { OrderType } from '@/generated/prisma/client';
import { PARKED_ORDER_MAX_AGE_MS, PARKED_ORDERS_MAX } from '@/config/constants';

/** Tout l'état d'un brouillon de commande (hors modales transitoires). */
export type OrderDraftSnapshot = {
  step: 'catalog' | 'review';
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  orderType: OrderType;
  note: string;
  pickupTime: string | null;
  orderDate: string | null;
  loyaltyRewardId: string | null;
};

export type ParkedOrder = OrderDraftSnapshot & {
  id: string;
  parkedAt: number;
};

const STORAGE_KEY = 'eba-parked-orders';

/** Une commande vide n'a rien à ranger. */
export function isParkable(draft: Pick<OrderDraftSnapshot, 'items'>): boolean {
  return draft.items.length > 0;
}

/** Écarte les brouillons périmés, puis plafonne (les plus récents gagnent). */
export function pruneParked(list: ParkedOrder[], now: number): ParkedOrder[] {
  return list
    .filter((p) => now - p.parkedAt <= PARKED_ORDER_MAX_AGE_MS)
    .sort((a, b) => b.parkedAt - a.parkedAt)
    .slice(0, PARKED_ORDERS_MAX)
    .sort((a, b) => a.parkedAt - b.parkedAt);
}

export function summarizeParked(p: ParkedOrder): {
  itemCount: number;
  total: number;
} {
  return {
    itemCount: p.items.reduce((s, i) => s + i.quantity, 0),
    total: p.items.reduce((s, i) => s + getItemTotal(i), 0),
  };
}

type ParkedOrdersStore = {
  parked: ParkedOrder[];
  hasHydrated: boolean;
  /** Range le brouillon ; sans effet s'il est vide. Renvoie l'id créé. */
  park: (draft: OrderDraftSnapshot) => string | null;
  /** Retire ET renvoie le brouillon (reprise). */
  take: (id: string) => ParkedOrder | null;
  discard: (id: string) => void;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useParkedOrdersStore = create<ParkedOrdersStore>()(
  persist(
    (set, get) => ({
      parked: [],
      hasHydrated: false,

      park: (draft) => {
        if (!isParkable(draft)) return null;
        const id = newId();
        const now = Date.now();
        set((state) => ({
          parked: pruneParked(
            [...state.parked, { ...draft, id, parkedAt: now }],
            now
          ),
        }));
        return id;
      },

      take: (id) => {
        const found = get().parked.find((p) => p.id === id) ?? null;
        if (found)
          set((state) => ({ parked: state.parked.filter((p) => p.id !== id) }));
        return found;
      },

      discard: (id) =>
        set((state) => ({ parked: state.parked.filter((p) => p.id !== id) })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ parked: state.parked }),
      // Réhydratation explicite (useParkedOrders) : pas de mismatch SSR.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Appelé aussi en cas d'échec (state undefined) : on lève toujours le
        // drapeau pour ne jamais bloquer l'UI sur un localStorage indisponible.
        useParkedOrdersStore.setState({
          hasHydrated: true,
          parked: pruneParked(state?.parked ?? [], Date.now()),
        });
      },
    }
  )
);
