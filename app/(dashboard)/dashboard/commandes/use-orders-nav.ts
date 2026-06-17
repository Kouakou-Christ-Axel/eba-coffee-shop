'use client';

// Navigation partagée des filtres de la liste des commandes. Un seul
// `useTransition` est partagé via contexte par tous les contrôles (statut,
// recherche, paiement, tri, dates, pagination) : ils restent réactifs et
// exposent un état d'attente commun (`isPending`) pour le retour visuel.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';

type NavigateOptions = { keepPage?: boolean };

export type OrdersNav = {
  /** Mute les params puis pousse l'URL dans une transition (scroll figé). */
  navigate: (
    mutate: (params: URLSearchParams) => void,
    options?: NavigateOptions
  ) => void;
  isPending: boolean;
  searchParams: ReadonlyURLSearchParams;
};

const OrdersNavContext = createContext<OrdersNav | null>(null);

/** Crée l'objet de navigation (transition + router) à fournir via le provider. */
export function useOrdersNavValue(): OrdersNav {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback<OrdersNav['navigate']>(
    (mutate, options) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!options?.keepPage) params.delete('page');
      mutate(params);
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `?${query}` : '?', { scroll: false });
      });
    },
    [router, searchParams]
  );

  return useMemo(
    () => ({ navigate, isPending, searchParams }),
    [navigate, isPending, searchParams]
  );
}

export const OrdersNavProvider = OrdersNavContext.Provider;

/** Accès à la navigation partagée depuis un contrôle de la toolbar. */
export function useOrdersNav(): OrdersNav {
  const ctx = useContext(OrdersNavContext);
  if (!ctx) {
    throw new Error('useOrdersNav doit être utilisé dans <OrdersToolbar>');
  }
  return ctx;
}
