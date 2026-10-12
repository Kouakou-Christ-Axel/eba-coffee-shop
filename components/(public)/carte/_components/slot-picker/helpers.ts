import { ABIDJAN_TZ, shiftDateString } from '@/lib/timezone';
import type { TimeRange } from '@/lib/pickup-settings';
import { isAvailableToday, isWithinAnyPeriod } from '@/lib/supplements';
import type { CartItem } from '@/lib/cart-store';

/** Jour civil Abidjan (YYYY-MM-DD) d'un créneau — Abidjan = UTC. */
export function slotDayKey(slot: Date): string {
  return slot.toISOString().slice(0, 10);
}

/** « 26 sept. » — date courte Abidjan, pour accompagner « Retrait demain ». */
export function shortDayDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    day: 'numeric',
    month: 'short',
  });
}

export function dayLabel(dateKey: string, today: string): string {
  if (dateKey === today) return "Aujourd'hui";
  if (dateKey === shiftDateString(today, 1)) return 'Demain';
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('fr-FR', {
    timeZone: ABIDJAN_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

/** Heure murale Abidjan courante « HH:MM », comparable aux plages. */
function nowAbidjanHHMM(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ABIDJAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}

export function isOpenNow(todayRanges: TimeRange[]): boolean {
  const now = nowAbidjanHHMM();
  return todayRanges.some((r) => r.start <= now && now <= r.end);
}

/** Vrai si TOUS les articles du panier sont disponibles à `date` (planning
 * récurrent ET fenêtre « spécialité de la semaine »). `date` absente = maintenant. */
export function isCartAvailableOn(items: CartItem[], date?: Date): boolean {
  return items.every(
    (i) =>
      isAvailableToday(i.availableDays ?? null, date) &&
      isWithinAnyPeriod(i.weeklySpecialPeriods ?? null, date)
  );
}
