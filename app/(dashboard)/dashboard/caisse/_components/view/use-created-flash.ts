'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export function useCreatedFlash() {
  // Confirmation de création : `/dashboard/caisse/new` redirige ici avec
  // `?cree=<n° du jour>`. Sans ça, valider une commande ne donnait AUCUN retour
  // au caissier (le n° renvoyé par l'API était jeté).
  const searchParams = useSearchParams();
  const createdParam = searchParams.get('cree');
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!createdParam) return;
    // Réaction à un paramètre d'URL, pas un dérivé recalculable au rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreatedFlash(createdParam);
    // On retire le paramètre pour qu'un rafraîchissement ne rejoue pas la
    // confirmation. `history.replaceState` plutôt que `router.replace` : pas de
    // re-rendu RSC de la file pour un simple nettoyage d'URL.
    window.history.replaceState(null, '', '/dashboard/caisse');
    const timer = setTimeout(() => setCreatedFlash(null), 8_000);
    return () => clearTimeout(timer);
  }, [createdParam]);
  return { createdFlash, setCreatedFlash };
}
