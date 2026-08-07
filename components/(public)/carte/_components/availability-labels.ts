// components/(public)/carte/_components/availability-labels.ts
//
// Libellés de disponibilité partagés par la carte produit (`product-card.tsx`)
// et l'en-tête de section catégorie (`carte-menu-section-client.tsx`) : un
// produit/catégorie hors planning ou hors fenêtre « spécialité de la semaine »
// reste visible avec un vrai message de retour, jamais une disparition
// silencieuse.

import { WEEKDAY_LABELS } from '@/lib/pickup-settings';
import { nextUpcomingPeriod } from '@/lib/supplements';
import { formatAbidjanShortDate } from '@/lib/timezone';

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/**
 * « Dispo le mercredi » (1 jour) ou « Dispo mer, ven » (plusieurs jours).
 * `days` vide = intersection produit×catégorie sans jour commun (configuration
 * incompatible) — libellé dédié plutôt qu'un « Dispo » vide.
 */
export function formatAvailableDaysLabel(days: number[]): string {
  const ordered = WEEKDAY_ORDER.filter((d) => days.includes(d));
  if (ordered.length === 0) return 'Indisponible';
  if (ordered.length === 1) {
    return `Dispo le ${WEEKDAY_LABELS[String(ordered[0])].toLowerCase()}`;
  }
  return `Dispo ${ordered.map((d) => WEEKDAY_LABELS[String(d)].slice(0, 3)).join(', ')}`;
}

/**
 * « Revient le {date courte} » si une fenêtre future « spécialité de la
 * semaine » est connue, sinon un libellé générique (produit ponctuel sans
 * retour programmé pour l'instant).
 */
export function formatWeeklySpecialLabel(
  periods: { startDate: string; endDate: string }[]
): string {
  const next = nextUpcomingPeriod(periods);
  if (next) return `Revient le ${formatAbidjanShortDate(next.startDate)}`;
  return 'Spécialité ponctuelle — indisponible';
}

/**
 * « Commande à J-3 » : délai de commande à l'avance requis (voir
 * `Product.advanceOrderDays`, lib/menu.ts). Contrairement aux autres libellés
 * de ce fichier, n'indique PAS une indisponibilité — le produit reste
 * commandable, seule la date de retrait choisie au checkout est contrainte.
 */
export function formatAdvanceOrderLabel(days: number): string {
  return `Commande à J-${days}`;
}
