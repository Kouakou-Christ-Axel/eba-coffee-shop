'use client';

// Recherche pilotée par la base (`GET <endpoint>?q=`, cf. lib/search/route.ts)
// pour un champ de saisie dont les éléments sont déjà chargés dans l'écran.
//
// - Saisie vide ⇒ `hits: null` : aucun filtre, aucune requête.
// - La saisie reste l'état local du composant et ne dépend JAMAIS de la réponse :
//   une réponse lente ne peut pas écraser ce qui a été tapé depuis.
// - Pendant qu'une requête est en vol on garde les derniers résultats connus
//   (pas de clignotement vers la liste complète) ; une réponse périmée n'est
//   jamais appliquée (annulation + clé de requête).

import { useEffect, useState } from 'react';
import type { SearchHit } from '@/lib/search/trgm';

const DEBOUNCE_MS = 200;

export function useSearchHits(endpoint: string, query: string) {
  const term = query.trim();
  const [loaded, setLoaded] = useState<{
    term: string;
    hits: SearchHit[];
  } | null>(null);

  useEffect(() => {
    if (term === '') return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${endpoint}?q=${encodeURIComponent(term)}`, {
        signal: ctrl.signal,
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((data: { hits: SearchHit[] }) =>
          setLoaded({ term, hits: data.hits })
        )
        .catch(() => {
          // Annulée (frappe suivante) ou réseau : on garde les derniers
          // résultats, la saisie n'est pas affectée.
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [endpoint, term]);

  return {
    hits: term === '' ? null : (loaded?.hits ?? null),
    /** true tant que les résultats affichés ne sont pas ceux de la saisie. */
    isPending: term !== '' && loaded?.term !== term,
  };
}
