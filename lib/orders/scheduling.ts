// lib/orders/scheduling.ts
//
// Helpers de planification (créneau de retrait) partagés entre les écrans
// dashboard qui manipulent des commandes programmées : caisse (`urgency.ts`) et
// préparation (KDS). Purs, sans dépendance à un type de commande précis : ils ne
// lisent que `pickupTime` et `status`, donc s'appliquent à `CashierOrder` comme
// à `PreparationOrder`.

import { SCHEDULED_LEAD_IN_MINUTES } from '@/config/constants';
import { formatAbidjanTime, startOfLocalDay } from '@/lib/timezone';
import type { OrderStatus } from '@/generated/prisma/client';

/** Forme minimale d'une commande pour les calculs de planification. */
export type SchedulableOrder = {
  pickupTime: Date | null;
  status: OrderStatus;
};

/** Minutes (arrondies) avant le retrait ; null si la commande n'a pas de `pickupTime`. */
export function minutesUntilPickup(
  order: Pick<SchedulableOrder, 'pickupTime'>,
  now: Date
): number | null {
  if (!order.pickupTime) return null;
  return Math.round((order.pickupTime.getTime() - now.getTime()) / 60_000);
}

/**
 * True si la commande est une commande programmée encore « en avance » : créneau de retrait
 * défini, à plus de `SCHEDULED_LEAD_IN_MINUTES` minutes, et toujours active (NEW/PREPARING).
 * Ces commandes vivent dans une section « Programmées » et n'entrent pas encore dans le flux
 * de travail courant (caisse « En cours » / cuisine « à cuisiner maintenant »).
 */
export function isScheduledAhead(order: SchedulableOrder, now: Date): boolean {
  if (order.status !== 'NEW' && order.status !== 'PREPARING') return false;
  const m = minutesUntilPickup(order, now);
  return m !== null && m > SCHEDULED_LEAD_IN_MINUTES;
}

/**
 * Libellé court du créneau de retrait :
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
