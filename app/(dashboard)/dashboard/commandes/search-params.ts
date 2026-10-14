// Définition UNIQUE des paramètres d'URL de la liste des commandes (nuqs).
// Partagée par le serveur (`createLoader`, cf. parse-search-params.ts) et par
// le client (`useQueryStates`, cf. use-orders-nav.ts) : une valeur invalide
// (statut inconnu, tri farfelu…) retombe sur `null`/défaut des deux côtés.
//
// Import depuis `nuqs/server` : aucun code React, utilisable côté serveur.

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { PAYMENT_MODES } from '@/lib/payment-modes';
import { dateRangeParsers, pageParser } from '@/lib/url-state/shared-params';

export const ORDER_STATUSES = [
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

export const ORDER_PAYMENT_FILTERS = ['unpaid', ...PAYMENT_MODES] as const;

export const ORDER_SORTS = [
  'recent',
  'oldest',
  'total_desc',
  'total_asc',
  'number',
] as const;

export const ordersParsers = {
  page: pageParser,
  status: parseAsStringLiteral(ORDER_STATUSES),
  payment: parseAsStringLiteral(ORDER_PAYMENT_FILTERS),
  sort: parseAsStringLiteral(ORDER_SORTS).withDefault('recent'),
  search: parseAsString,
  // Plage de dates (from / to / range) : partagée avec `DateRangeFilter`.
  ...dateRangeParsers,
};
