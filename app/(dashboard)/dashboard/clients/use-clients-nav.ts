'use client';

// Filtres de la liste des clients, branchés sur l'URL via nuqs (même patron que
// `commandes/use-orders-nav.ts`). `shallow: false` : chaque changement d'URL
// relance le rendu serveur de la page (c'est lui qui interroge la base).
//
// L'état renvoyé est mis à jour IMMÉDIATEMENT, y compris pendant un debounce :
// c'est lui qui alimente le champ de recherche. Ne jamais recopier la valeur
// serveur (`initial`) dans un état local au retour d'une réponse — une réponse
// lente écraserait ce que l'utilisateur a tapé entre-temps (le « rollback »).

import { useCallback, useMemo, useTransition } from 'react';
import { debounce, useQueryStates, type Values } from 'nuqs';
import { clientsParsers } from './search-params';

export type ClientsFilters = Values<typeof clientsParsers>;
export type ClientsFiltersPatch = {
  [K in keyof ClientsFilters]?: ClientsFilters[K] | null;
};

export function useClientsNav() {
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(clientsParsers, {
    shallow: false,
    history: 'push',
    scroll: false,
    startTransition,
  });

  /** Applique un patch ; repasse à la page 1. `debounceMs` : saisie au clavier. */
  const update = useCallback(
    (patch: ClientsFiltersPatch, options?: { debounceMs?: number }) => {
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
