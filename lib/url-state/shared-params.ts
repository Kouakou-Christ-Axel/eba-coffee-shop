// Paramètres d'URL communs aux pages du dashboard (nuqs) : pagination et plage
// de dates. Définis UNE fois, pour `Pagination` et `DateRangeFilter`
// (composants partagés par plusieurs pages) comme pour les pages qui les
// étendent (cf. `commandes/search-params.ts`).
//
// Import depuis `nuqs/server` : aucun code React, utilisable côté serveur.

import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server';

/** Page courante (1-indexée). `1` est le défaut : retiré de l'URL. */
export const pageParser = parseAsInteger.withDefault(1);

/** Plage en jour civil Abidjan (YYYY-MM-DD) ; `range=all` désactive le filtre. */
export const dateRangeParsers = {
  from: parseAsString,
  to: parseAsString,
  range: parseAsStringLiteral(['all'] as const),
};

/** Changement de plage émis par `DateRangeFilter`. */
export type RangeChange = { from?: string; to?: string; all?: boolean };

/**
 * Traduit un changement de plage en patch d'URL. « Tout » retire les bornes ;
 * sinon `range` est retiré et seules les bornes fournies sont écrites. Repasse
 * toujours à la page 1 : l'ancienne page n'a plus de sens sur une autre plage.
 */
export function rangeChangeToParams(next: RangeChange) {
  if (next.all)
    return { page: null, range: 'all' as const, from: null, to: null };
  return {
    page: null,
    range: null,
    ...(next.from ? { from: next.from } : {}),
    ...(next.to ? { to: next.to } : {}),
  };
}
