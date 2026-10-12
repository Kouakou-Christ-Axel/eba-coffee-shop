'use client';

// État d'URL de la caisse, branché sur nuqs : onglet, recherche, et
// confirmation « commande créée » (`?cree=`). `history: 'replace'` : changer
// d'onglet ou taper une recherche ne doit pas empiler d'entrées d'historique.

import { useCallback, useEffect, useState } from 'react';
import { useQueryStates } from 'nuqs';
import type { TabKey } from './urgency';
import { caisseParsers } from './search-params';

const CREATED_FLASH_MS = 8_000;

export function useCaisseParams() {
  const [{ onglet, q, cree }, setParams] = useQueryStates(caisseParsers, {
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

  // Sans ce retour, valider une commande ne donnait AUCUN signe au caissier
  // (le n° renvoyé par l'API était jeté). On le copie en état local puis on
  // retire le paramètre : un rafraîchissement ne rejoue pas la confirmation.
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!cree) return;
    // Réaction à un paramètre d'URL, pas un dérivé recalculable au rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatedFlash(cree);
    void setParams({ cree: null });
  }, [cree, setParams]);

  // Timer séparé : retirer `?cree=` ci-dessus ne doit pas l'annuler.
  useEffect(() => {
    if (!createdFlash) return;
    const timer = setTimeout(() => setCreatedFlash(null), CREATED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [createdFlash]);

  return {
    tab: onglet,
    setTab,
    search: q ?? '',
    setSearch,
    createdFlash,
    dismissCreatedFlash: () => setCreatedFlash(null),
  };
}
