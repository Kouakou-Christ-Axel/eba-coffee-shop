// app/(dashboard)/dashboard/caisse/urgency.ts
//
// Helpers d'urgence pour la vue caisse :
//   - calcul de l'âge d'une commande
//   - classification en 4 niveaux (normal / attention / alert / critical)
//   - style Tailwind associé à chaque niveau
//
// Seuils centralisés ici : facile à ajuster sans toucher au reste.

import type { CashierOrder } from '@/lib/cashier-queue';
import {
  SCHEDULED_ALERT_MINUTES,
  SCHEDULED_LEAD_IN_MINUTES,
} from '@/config/constants';
import { formatAbidjanTime, startOfLocalDay } from '@/lib/timezone';

export type UrgencyLevel = 'normal' | 'attention' | 'alert' | 'critical';

export type TabKey = 'to-pay' | 'in-progress' | 'ready';

// Seuils en minutes : `attention` >= seuils[0], `alert` >= seuils[1], `critical` >= seuils[2].
const THRESHOLDS: Record<TabKey, [number, number, number]> = {
  'to-pay': [5, 10, 15],
  'in-progress': [10, 20, 30],
  ready: [3, 7, 10],
};

/** Âge en minutes entières, négatif arrondi à 0. */
export function getOrderAgeMinutes(createdAt: Date, now: Date): number {
  const diffMs = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(diffMs / 60_000));
}

/** Format français court : "à l'instant" / "il y a 12 min" / "il y a 1 h 23". */
export function formatElapsedShort(createdAt: Date, now: Date): string {
  const minutes = getOrderAgeMinutes(createdAt, now);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `il y a ${hours} h ${String(rest).padStart(2, '0')}`;
}

/** True si `pickupTime` est défini et déjà passé. */
export function isPickupOverdue(order: CashierOrder, now: Date): boolean {
  if (!order.pickupTime) return false;
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED')
    return false;
  return order.pickupTime.getTime() < now.getTime();
}

/** Minutes (arrondies) avant le retrait ; null si la commande n'a pas de `pickupTime`. */
export function minutesUntilPickup(
  order: CashierOrder,
  now: Date
): number | null {
  if (!order.pickupTime) return null;
  return Math.round((order.pickupTime.getTime() - now.getTime()) / 60_000);
}

/**
 * True si la commande est une commande programmée encore « en avance » : créneau de retrait
 * défini, à plus de `SCHEDULED_LEAD_IN_MINUTES` minutes, et toujours active (NEW/PREPARING).
 * Ces commandes vivent dans la section « Programmées » et n'entrent pas encore dans « En cours ».
 */
export function isScheduledAhead(order: CashierOrder, now: Date): boolean {
  if (order.status !== 'NEW' && order.status !== 'PREPARING') return false;
  const m = minutesUntilPickup(order, now);
  return m !== null && m > SCHEDULED_LEAD_IN_MINUTES;
}

/**
 * Libellé court du créneau de retrait pour la carte caisse :
 *   « aujourd'hui 15:30 » / « demain 15:30 » / « 14/06 15:30 ».
 */
export function formatPickup(pickup: Date, now: Date): string {
  // Heure et bornes de jour ancrées sur Abidjan (déterministe hors UTC).
  const time = formatAbidjanTime(pickup);
  const dayDiff = Math.round(
    (startOfLocalDay(pickup).getTime() - startOfLocalDay(now).getTime()) /
      86_400_000
  );
  if (dayDiff <= 0) return `aujourd'hui ${time}`;
  if (dayDiff === 1) return `demain ${time}`;
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: '2-digit',
  }).format(pickup);
  return `${date} ${time}`;
}

/**
 * Niveau d'urgence pour une commande dans le contexte d'un tab donné.
 *
 * Règles :
 *   - pickupTime dépassé (commande online en retard) → critical, peu importe l'âge
 *   - commande AVEC pickupTime → urgence dérivée de la proximité du retrait (et non de
 *     l'âge) : elle reste « normal » tant que le retrait est lointain, puis monte à
 *     l'approche. Évite qu'une programmée créée il y a des heures soit faussement critique.
 *   - commande SANS pickupTime (walk-in) → niveau dérivé de l'âge depuis createdAt
 */
export function getUrgencyLevel(
  order: CashierOrder,
  tab: TabKey,
  now: Date
): UrgencyLevel {
  if (isPickupOverdue(order, now)) return 'critical';

  const untilPickup = minutesUntilPickup(order, now);
  if (untilPickup !== null) {
    if (untilPickup <= 5) return 'critical';
    if (untilPickup <= 10) return 'alert';
    if (untilPickup <= SCHEDULED_ALERT_MINUTES) return 'attention';
    return 'normal';
  }

  const age = getOrderAgeMinutes(order.createdAt, now);
  const [attentionAt, alertAt, criticalAt] = THRESHOLDS[tab];
  if (age >= criticalAt) return 'critical';
  if (age >= alertAt) return 'alert';
  if (age >= attentionAt) return 'attention';
  return 'normal';
}

/** Styles Tailwind par niveau. */
export const URGENCY_STYLES: Record<
  UrgencyLevel,
  {
    borderClass: string;
    textClass: string;
    label: string;
  }
> = {
  normal: {
    borderClass: 'border-border',
    textClass: 'text-muted-foreground',
    label: 'Récente',
  },
  attention: {
    borderClass: 'border-yellow-300 dark:border-yellow-700',
    textClass: 'text-yellow-700 dark:text-yellow-300',
    label: 'En attente',
  },
  alert: {
    borderClass: 'border-orange-400 dark:border-orange-600',
    textClass: 'text-orange-700 dark:text-orange-300',
    label: 'Tarde',
  },
  critical: {
    borderClass:
      'border-red-500 ring-1 ring-red-200 dark:ring-red-900/60 animate-pulse',
    textClass: 'text-red-700 dark:text-red-300',
    label: 'Urgent',
  },
};

/**
 * Détermine quel tab afficher en priorité quand l'utilisateur clique
 * "Voir" depuis le bandeau d'alerte. Priorité : Prêtes > À encaisser > En cours
 * (la Prête est ce qui refroidit le plus).
 */
export function pickFirstCriticalTab(
  criticals: Record<TabKey, number>
): TabKey | null {
  if (criticals.ready > 0) return 'ready';
  if (criticals['to-pay'] > 0) return 'to-pay';
  if (criticals['in-progress'] > 0) return 'in-progress';
  return null;
}
