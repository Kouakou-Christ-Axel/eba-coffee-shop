'use client';

import { useEffect, useState } from 'react';
import { useQueryState } from 'nuqs';
import { caisseParsers } from '../../search-params';

const CREATED_FLASH_MS = 8_000;

export function useCreatedFlash() {
  // Confirmation de création : `/dashboard/caisse/new` redirige ici avec
  // `?cree=<n° du jour>`. Sans ça, valider une commande ne donnait AUCUN retour
  // au caissier (le n° renvoyé par l'API était jeté).
  const [createdParam, setCreatedParam] = useQueryState(
    'cree',
    caisseParsers.cree.withOptions({ history: 'replace' })
  );
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!createdParam) return;
    // Réaction à un paramètre d'URL, pas un dérivé recalculable au rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatedFlash(createdParam);
    // On retire le paramètre pour qu'un rafraîchissement ne rejoue pas la
    // confirmation. nuqs est `shallow` par défaut : pas de re-rendu RSC de la
    // file pour un simple nettoyage d'URL.
    void setCreatedParam(null);
  }, [createdParam, setCreatedParam]);

  // Timer séparé : retirer `?cree=` ci-dessus ne doit pas l'annuler.
  useEffect(() => {
    if (!createdFlash) return;
    const timer = setTimeout(() => setCreatedFlash(null), CREATED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [createdFlash]);

  return { createdFlash, setCreatedFlash };
}
