'use client';

// lib/hooks/use-inventory-count.ts
//
// Le brouillon de comptage, persisté en localStorage. Même patron que
// `lib/cart-store.ts` (zustand + `persist`), pour la même raison : une saisie
// longue ne doit pas dépendre du fait que l'écran reste allumé.
//
// `skipHydration` est le point délicat, et c'est aussi la raison de ce fichier
// séparé : sans lui, `persist` lit localStorage au premier rendu, le serveur
// rend « 0 / 117 » et le client « 23 / 117 » — React 19 lève un désaccord
// d'hydratation sur le compteur de progression. On réhydrate donc
// explicitement, dans un effet (`useInventoryCountHydration`), et tout écran
// qui affiche l'état du brouillon attend `hasHydrated`.
//
// La logique (parsing, réconciliation, écarts) vit dans
// `lib/inventory-count-draft.ts`, pure et testée. Ici, uniquement le stockage.

import { useEffect } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { INVENTORY_COUNT_DRAFT_MAX_AGE_MS } from '@/config/constants';
import {
  isDraftStale,
  reconcileDraft,
  type CountDraft,
  type DraftReconciliation,
} from '@/lib/inventory-count-draft';

// Même convention de préfixe que 'eba-cart' et 'eba-orders'.
const STORAGE_KEY = 'eba-inventory-count';

function emptyDraft(date: string): CountDraft {
  const now = Date.now();
  return {
    date,
    label: '',
    counts: {},
    systemAt: {},
    itemIds: [],
    startedAt: now,
    updatedAt: now,
  };
}

type InventoryCountStore = {
  /** `null` = aucun comptage en cours. */
  draft: CountDraft | null;
  /**
   * Vrai une fois la réhydratation terminée (ou échouée). Le store démarre vide
   * côté SSR et au 1ᵉʳ rendu client : tout affichage dérivé du brouillon doit
   * attendre ce drapeau.
   */
  hasHydrated: boolean;

  /** Démarre un comptage, ou reprend celui en cours s'il porte la même date. */
  start: (date: string, itemIds: string[]) => void;
  /** Enregistre une saisie BRUTE. `''` remet la référence à « non comptée ». */
  setCount: (itemId: string, raw: string, systemQuantity: number) => void;
  setLabel: (label: string) => void;
  /** Change la date sans perdre les saisies (passage de minuit, report). */
  setDate: (date: string) => void;
  /** Réaccorde le brouillon avec le catalogue courant. */
  reconcile: (
    items: { id: string; currentQuantity: number }[]
  ) => DraftReconciliation | null;
  clear: () => void;
};

export const useInventoryCountStore = create<InventoryCountStore>()(
  persist(
    (set, get) => ({
      draft: null,
      hasHydrated: false,

      start: (date, itemIds) => {
        const current = get().draft;
        if (current && current.date === date) {
          set({ draft: { ...current, itemIds, updatedAt: Date.now() } });
          return;
        }
        set({ draft: { ...emptyDraft(date), itemIds } });
      },

      setCount: (itemId, raw, systemQuantity) => {
        const current = get().draft;
        if (!current) return;
        const counts = { ...current.counts };
        const systemAt = { ...current.systemAt };
        if (raw.trim() === '') {
          // Effacer une saisie la ramène à « non comptée » : on retire la clé
          // plutôt que de stocker une chaîne vide, pour que le brouillon dise
          // exactement ce qu'il contient.
          delete counts[itemId];
          delete systemAt[itemId];
        } else {
          counts[itemId] = raw;
          systemAt[itemId] = systemQuantity;
        }
        set({ draft: { ...current, counts, systemAt, updatedAt: Date.now() } });
      },

      setLabel: (label) => {
        const current = get().draft;
        if (!current) return;
        set({ draft: { ...current, label, updatedAt: Date.now() } });
      },

      setDate: (date) => {
        const current = get().draft;
        if (!current) return;
        set({ draft: { ...current, date, updatedAt: Date.now() } });
      },

      reconcile: (items) => {
        const current = get().draft;
        if (!current) return null;
        const result = reconcileDraft(current, items);
        set({ draft: result.draft });
        return result;
      },

      clear: () => set({ draft: null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ draft: state.draft }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        // Appelé aussi en cas d'échec (`state` undefined) : on lève toujours le
        // drapeau, pour ne jamais bloquer l'écran sur un localStorage
        // indisponible (navigation privée, stockage refusé).
        const stale =
          state?.draft != null &&
          isDraftStale(
            state.draft,
            Date.now(),
            INVENTORY_COUNT_DRAFT_MAX_AGE_MS
          );
        useInventoryCountStore.setState({
          hasHydrated: true,
          ...(stale ? { draft: null } : {}),
        });
      },
    }
  )
);

/**
 * Déclenche la réhydratation du brouillon (idempotent) et renvoie `true` une
 * fois terminée. À appeler par tout composant dont l'affichage dépend du
 * brouillon — l'écran de comptage comme la carte de reprise de l'onglet.
 */
export function useInventoryCountHydration(): boolean {
  const hasHydrated = useInventoryCountStore((s) => s.hasHydrated);
  useEffect(() => {
    void useInventoryCountStore.persist.rehydrate();
  }, []);
  return hasHydrated;
}
