'use client';

// lib/hooks/use-parked-orders.ts
//
// Colle le store des commandes mises de côté à l'état de `useNewOrder` :
// `snapshot` capture le brouillon courant, `apply` le restaure, `reset` le
// remet à neuf.
import { useEffect } from 'react';
import {
  isParkable,
  useParkedOrdersStore,
  type OrderDraftSnapshot,
} from '@/lib/parked-orders-store';

type Options = {
  snapshot: OrderDraftSnapshot;
  apply: (draft: OrderDraftSnapshot) => void;
  reset: () => void;
};

export function useParkedOrders({ snapshot, apply, reset }: Options) {
  const parked = useParkedOrdersStore((s) => s.parked);
  const hasHydrated = useParkedOrdersStore((s) => s.hasHydrated);

  useEffect(() => {
    void useParkedOrdersStore.persist.rehydrate();
  }, []);

  const canPark = isParkable(snapshot);

  /** Range la commande en cours et repart d'un panier neuf. */
  function parkCurrent() {
    if (!canPark) return;
    useParkedOrdersStore.getState().park(snapshot);
    reset();
  }

  /**
   * Reprend un brouillon. La commande en cours (si elle a des articles) est
   * rangée à sa place : on échange, rien n'est jamais perdu.
   */
  function resume(id: string) {
    const store = useParkedOrdersStore.getState();
    const target = store.take(id);
    if (!target) return;
    if (canPark) store.park(snapshot);
    apply(target);
  }

  function discard(id: string) {
    useParkedOrdersStore.getState().discard(id);
  }

  return {
    parked: hasHydrated ? parked : [],
    canPark,
    parkCurrent,
    resume,
    discard,
  };
}
