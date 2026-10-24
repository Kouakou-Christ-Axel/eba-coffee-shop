// Définition UNIQUE des paramètres d'URL de la liste des clients (nuqs).
// Partagée par le serveur (`createLoader`, cf. page.tsx) et par le client
// (`useQueryStates`, cf. use-clients-nav.ts) : une valeur invalide (page
// « abc », tri inconnu…) retombe sur `null`/défaut des deux côtés.
//
// Import depuis `nuqs/server` : aucun code React, utilisable côté serveur.

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import type { CustomerSortKey, SortDir } from '@/lib/customers';
import { pageParser } from '@/lib/url-state/shared-params';

export const CUSTOMER_SORT_KEYS = [
  'name',
  'ordersCount',
  'totalSpent',
  'lastOrderAt',
] as const satisfies readonly CustomerSortKey[];

export const CUSTOMER_SORT_DIRS = [
  'desc',
  'asc',
] as const satisfies readonly SortDir[];

export const clientsParsers = {
  page: pageParser,
  search: parseAsString,
  // Sans `sort`, le serveur trie par création décroissante (ou par pertinence
  // quand une recherche est active) : `null` est donc une vraie valeur.
  sort: parseAsStringLiteral(CUSTOMER_SORT_KEYS),
  dir: parseAsStringLiteral(CUSTOMER_SORT_DIRS).withDefault('desc'),
};
