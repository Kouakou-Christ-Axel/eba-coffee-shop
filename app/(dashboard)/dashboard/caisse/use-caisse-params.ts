'use client';

// Onglet actif et recherche de la caisse, branchés sur l'URL via nuqs.
// `history: 'replace'` : changer d'onglet ou taper une recherche ne doit pas
// empiler d'entrées d'historique. `shallow` (défaut) : la file du jour arrive
// par SSE et se filtre en mémoire, aucun rendu serveur à relancer.

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import type { TabKey } from './urgency';
import { caisseParsers } from './search-params';

export function useCaisseParams() {
  const [{ onglet, q }, setParams] = useQueryStates(caisseParsers, {
    history: 'replace',
  });

  const setTab = useCallback(
    (tab: TabKey) => void setParams({ onglet: tab }),
    [setParams]
  );
  const setSearch = useCallback(
    (value: string) => void setParams({ q: value.trim() ? value : null }),
    [setParams]
  );

  return { tab: onglet, setTab, search: q ?? '', setSearch };
}
