// Paramètres d'URL de la caisse (nuqs) : onglet actif, recherche et
// confirmation de création. Importés depuis `nuqs/server` : aucun code React.
//
// Tous restent CÔTÉ CLIENT (`shallow` par défaut) : la file du jour arrive par
// SSE et se filtre en mémoire, aucune raison de relancer le rendu serveur.

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import type { TabKey } from './urgency';

export const TAB_KEYS = [
  'to-pay',
  'in-progress',
  'ready',
] as const satisfies readonly TabKey[];

export const caisseParsers = {
  onglet: parseAsStringLiteral(TAB_KEYS).withDefault('to-pay'),
  // Recherche : code de retrait, n° du jour, nom ou téléphone.
  q: parseAsString,
  // `/dashboard/caisse/new` redirige ici avec `?cree=<n° du jour>`.
  cree: parseAsString,
};
