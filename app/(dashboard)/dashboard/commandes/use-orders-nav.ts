'use client';

// Filtres de la liste des commandes, branchés sur l'URL via nuqs. Un seul
// `useTransition` est partagé via contexte par tous les contrôles (statut,
// recherche, paiement, tri, dates) : ils restent réactifs et exposent un état
// d'attente commun (`isPending`) pour le retour visuel.
//
// `shallow: false` : chaque changement d'URL relance le rendu serveur de la
// page (c'est lui qui interroge la base). L'état local, lui, est mis à jour
// immédiatement — y compris pendant un debounce — donc l'interface ne lagge pas.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
} from 'react';
import { debounce, useQueryStates, type Values } from 'nuqs';
import { ordersParsers } from './search-params';

export type OrdersFilters = Values<typeof ordersParsers>;
export type OrdersFiltersPatch = {
  [K in keyof OrdersFilters]?: OrdersFilters[K] | null;
};

type UpdateOptions = {
  /** Retarde l'écriture dans l'URL (saisie au clavier). */
  debounceMs?: number;
};

export type OrdersNav = {
  filters: OrdersFilters;
  /** Applique un patch de filtres ; repasse à la page 1 (`page` retiré de l'URL). */
  update: (patch: OrdersFiltersPatch, options?: UpdateOptions) => void;
  isPending: boolean;
};

const OrdersNavContext = createContext<OrdersNav | null>(null);

/** Crée l'objet de navigation (transition + état nuqs) à fournir via le provider. */
export function useOrdersNavValue(): OrdersNav {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(ordersParsers, {
    shallow: false,
    history: 'push',
    scroll: false,
    startTransition,
  });

  const update = useCallback<OrdersNav['update']>(
    (patch, options) => {
      void setFilters(
        { ...patch, page: null },
        options?.debounceMs
          ? { limitUrlUpdates: debounce(options.debounceMs) }
          : undefined
      );
    },
    [setFilters]
  );

  return useMemo(
    () => ({ filters, update, isPending }),
    [filters, update, isPending]
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
