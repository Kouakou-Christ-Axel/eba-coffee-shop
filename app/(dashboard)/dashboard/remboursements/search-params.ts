// Définition UNIQUE des paramètres d'URL de la liste des remboursements (nuqs),
// partagée par le serveur (`createLoader`) et le client (`useQueryStates`).

import { parseAsString, parseAsStringLiteral } from 'nuqs/server';
import { PAYMENT_MODES } from '@/lib/payment-modes';
import { dateRangeParsers, pageParser } from '@/lib/url-state/shared-params';

/** Onglets : files de travail puis historique. */
export const REFUND_TABS = ['validate', 'fix', 'progress', 'history'] as const;
export type RefundTab = (typeof REFUND_TABS)[number];

export const refundsParsers = {
  page: pageParser,
  tab: parseAsStringLiteral(REFUND_TABS).withDefault('validate'),
  channel: parseAsStringLiteral(PAYMENT_MODES),
  // Remboursement ouvert dans le panneau de détail (lien partageable).
  open: parseAsString,
  // Plage sur la date de demande (sert surtout à l'historique).
  ...dateRangeParsers,
};
