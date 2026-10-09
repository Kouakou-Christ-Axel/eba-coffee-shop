import type { Product } from '@/config/menu';
import {
  formatLocalDateOnly,
  getAbidjanWeekday,
  shiftDateString,
} from '@/lib/timezone';

export function isPausedNow(
  unavailableUntil: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!unavailableUntil) return false;
  const until =
    typeof unavailableUntil === 'string'
      ? new Date(unavailableUntil)
      : unavailableUntil;
  return until.getTime() > now.getTime();
}

export function isAvailableToday(
  availableDays: number[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (availableDays == null) return true;
  return availableDays.includes(getAbidjanWeekday(now));
}

/** Fenêtres « spécialité de la semaine » (`Product.weeklySpecialPeriods`). */
export function isWithinAnyPeriod(
  periods: { startDate: string; endDate: string }[] | null | undefined,
  now: Date = new Date()
): boolean {
  if (!periods || periods.length === 0) return true;
  const today = formatLocalDateOnly(now);
  return periods.some((p) => p.startDate <= today && today <= p.endDate);
}

export function isOrderableNow(product: Product, now: Date = new Date()) {
  return (
    product.soldOut !== true &&
    !isPausedNow(product.unavailableUntil, now) &&
    isAvailableToday(product.availableDays, now) &&
    isWithinAnyPeriod(product.weeklySpecialPeriods, now)
  );
}

/** Le produit peut-il être commandé POUR UN AUTRE JOUR ? */
export function canOrderForLaterDay(product: Product, now: Date = new Date()) {
  return (
    !isPausedNow(product.unavailableUntil, now) &&
    isAvailableToday(product.availableDays, now) &&
    isWithinAnyPeriod(product.weeklySpecialPeriods, now)
  );
}

export function isPickupDateAllowed(
  advanceOrderDays: number | null | undefined,
  pickupDate: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!advanceOrderDays) return true;
  if (!pickupDate) return false;
  const pickupStr =
    typeof pickupDate === 'string'
      ? formatLocalDateOnly(new Date(pickupDate))
      : formatLocalDateOnly(pickupDate);
  return (
    pickupStr >= shiftDateString(formatLocalDateOnly(now), advanceOrderDays)
  );
}

/** Délai de commande à l'avance EFFECTIF d'une ligne de panier, en jours civils. */
export function effectiveItemAdvanceDays(item: {
  advanceOrderDays?: number | null;
  soldOutToday?: boolean;
}): number {
  return Math.max(item.advanceOrderDays ?? 0, item.soldOutToday ? 1 : 0);
}

export function minAllowedPickupDateString(
  advanceOrderDays: number,
  now: Date = new Date()
): string {
  return shiftDateString(formatLocalDateOnly(now), advanceOrderDays);
}

export function nextUpcomingPeriod(
  periods: { startDate: string; endDate: string }[] | null | undefined,
  now: Date = new Date()
): { startDate: string; endDate: string } | null {
  const today = formatLocalDateOnly(now);
  return (
    (periods ?? [])
      .filter((p) => p.startDate > today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
  );
}
