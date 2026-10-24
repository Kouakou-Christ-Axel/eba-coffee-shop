// Définition UNIQUE des paramètres d'URL de la page Jèko (nuqs), partagée par le
// serveur (`createLoader`, cf. parse-search-params.ts) et le client
// (`useQueryStates`, cf. jeko-toolbar.tsx) : un compte inconnu retombe sur `null`
// (tous les comptes) des deux côtés.
//
// Import depuis `nuqs/server` : aucun code React, utilisable côté serveur.

import { parseAsStringLiteral } from 'nuqs/server';
import { JEKO_ACCOUNTS } from '@/lib/jeko/accounts';
import { dateRangeParsers } from '@/lib/url-state/shared-params';

export const jekoParsers = {
  /** `null` = tous les comptes. */
  account: parseAsStringLiteral(JEKO_ACCOUNTS),
  // Plage de dates (from / to / range) : partagée avec `DateRangeFilter`.
  ...dateRangeParsers,
};
