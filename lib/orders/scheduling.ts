// lib/orders/scheduling.ts
//
// Helpers de planification (créneau de retrait) partagés entre les écrans
// dashboard qui manipulent des commandes programmées : caisse (`urgency.ts`) et
// préparation (KDS). Purs, sans dépendance à un type de commande précis : ils ne
// lisent que `pickupTime` et `status`, donc s'appliquent à `CashierOrder` comme
// à `PreparationOrder`.

import {
  DEFERRED_PICKUP_DEFAULT_TIME,
  SCHEDULED_LEAD_IN_MINUTES,
} from '@/config/constants';
import {
  abidjanDatetimeLocalToISO,
  formatAbidjanTime,
  formatLocalDateOnly,
  isoToAbidjanDatetimeLocal,
  shiftDateString,
  startOfLocalDay,
  todayDateString,
} from '@/lib/timezone';
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

// ─── Jour civil de retrait ────────────────────────────────────────────────────

/** Coerce une entrée `Date | string` en `Date` (les formulaires manipulent des
 * chaînes ISO, la base des `Date` — les deux doivent passer par ici). */
function toDate(value: Date | string): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/**
 * Écart en JOURS CIVILS Abidjan entre `a` et `b` (0 = même jour, 1 = `a` est
 * le lendemain de `b`). Passe par `startOfLocalDay` des deux côtés : comparer
 * des instants bruts ferait basculer le résultat selon l'heure de la journée.
 */
function localDayDiff(a: Date, b: Date): number {
  return Math.round(
    (startOfLocalDay(a).getTime() - startOfLocalDay(b).getTime()) / 86_400_000
  );
}

/**
 * Décalage du retrait en jours civils Abidjan : 0 = aujourd'hui, 1 = demain,
 * négatif = déjà passé. `null` si la commande n'a pas de créneau.
 */
export function pickupDayOffset(
  pickupTime: Date | string | null | undefined,
  now: Date
): number | null {
  if (!pickupTime) return null;
  return localDayDiff(toDate(pickupTime), now);
}

/**
 * LE prédicat métier de la commande différée : le retrait tombe-t-il un JOUR
 * CIVIL ULTÉRIEUR ?
 *
 * Une commande différée ne consomme JAMAIS le stock d'aujourd'hui — ni à la
 * création, ni à l'encaissement. Le décompte a lieu le jour J, à l'entrée en
 * cuisine (`reserveStockOnce`, lib/order-mutations.ts), sur un geste humain.
 *
 * Le critère est le jour CIVIL, pas un nombre d'heures : « pour 18h ce soir »
 * est bien servi avec le stock du jour et reste donc `false`, alors même que
 * le retrait est lointain (c'est `isScheduledAhead` qui gère ce cas-là, pour
 * l'organisation de la file — pas pour le stock).
 *
 * Accepte une `Date` ou une chaîne ISO : ce prédicat sert aussi bien les
 * lectures base que les formulaires client.
 */
export function isDeferredPickup(
  pickupTime: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  const offset = pickupDayOffset(pickupTime, now);
  return offset !== null && offset > 0;
}

// ─── Fabriquer un créneau « jour + heure » ────────────────────────────────────
//
// Tous les raccourcis de temps de l'app (« Demain 11h » en caisse, chez l'admin
// et sur la carte publique) posent la MÊME valeur : un jour civil Abidjan à une
// heure murale. Quatre fonctions d'une ligne, mais une seule façon de la
// construire — quatre écrans qui recomposeraient la chaîne à la main
// finiraient par diverger sur un fuseau ou un zéro non complété.

/** Jour civil Abidjan à J+`dayOffset` (YYYY-MM-DD). `0` = aujourd'hui. */
export function pickupDayString(dayOffset: number): string {
  return shiftDateString(todayDateString(), dayOffset);
}

/**
 * Valeur `datetime-local` (heure murale Abidjan) : « 2026-08-15T11:00 ».
 * C'est la forme qu'attendent les `<input type="datetime-local">`.
 */
export function pickupLocalAt(
  day: string,
  time: string = DEFERRED_PICKUP_DEFAULT_TIME
): string {
  return `${day}T${time}`;
}

/** Même créneau en ISO 8601 (UTC), ancré Abidjan. `null` si entrée invalide. */
export function pickupISOAt(
  day: string,
  time: string = DEFERRED_PICKUP_DEFAULT_TIME
): string | null {
  return abidjanDatetimeLocalToISO(pickupLocalAt(day, time));
}

/**
 * Ce créneau tombe-t-il EXACTEMENT ce jour-là à cette heure-là ?
 *
 * Sert à allumer un raccourci : son état actif est ainsi DÉRIVÉ de la valeur
 * réellement soumise, jamais stocké en parallèle (un état dupliqué se
 * désynchronise, et c'est la valeur soumise qui compte). Ne marche que pour un
 * raccourci visant un instant ABSOLU — un préset relatif (« dans 2h ») n'est
 * pas reconnaissable après coup, il lui faut un état explicite.
 */
export function isPickupAt(
  pickupTime: Date | string | null | undefined,
  day: string,
  time: string = DEFERRED_PICKUP_DEFAULT_TIME
): boolean {
  if (!pickupTime) return false;
  return isoToAbidjanDatetimeLocal(pickupTime) === pickupLocalAt(day, time);
}

/**
 * Jour civil de PRODUCTION d'une commande (YYYY-MM-DD, Abidjan) : le jour du
 * retrait s'il est fixé, sinon le jour de création. C'est la clé de
 * regroupement de la liste « À produire » (lib/orders/production-plan.ts).
 */
export function orderProductionDay(order: {
  pickupTime: Date | null;
  createdAt: Date;
}): string {
  return formatLocalDateOnly(order.pickupTime ?? order.createdAt);
}

/**
 * Commande à créneau pas encore lancée en cuisine : elle attend le geste
 * humain « Lancer la préparation », qu'elle soit payée ou non.
 *
 * Sert à la garder visible dans « Programmées » (caisse ET cuisine) au-delà de
 * `SCHEDULED_LEAD_IN_MINUTES` : une différée PAYÉE reste `NEW`, donc absente de
 * « à encaisser » comme de « en cours ». Sans ce prédicat elle disparaîtrait de
 * tous les écrans au moment précis où il faut la lancer.
 */
export function isAwaitingKitchenLaunch(order: SchedulableOrder): boolean {
  return order.status === 'NEW' && order.pickupTime !== null;
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
  const dayDiff = localDayDiff(pickup, now);
  if (dayDiff <= 0) return `aujourd'hui ${time}`;
  if (dayDiff === 1) return `demain ${time}`;
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Abidjan',
    day: '2-digit',
    month: '2-digit',
  }).format(pickup);
  return `${date} ${time}`;
}
