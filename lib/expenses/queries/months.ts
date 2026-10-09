import { todayDateString, parseDateOnlyToUTC } from '@/lib/timezone';

/** Mois civil 'YYYY-MM' d'une Date (Abidjan = UTC → composantes UTC). */
export function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Liste des mois civils 'YYYY-MM' couverts (inclus) par une plage de Dates. */
export function listMonthKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1);
  while (cursor.getTime() <= end) {
    keys.push(monthKeyOf(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/** Nombre de mois civils couverts (inclusif) par une plage de Dates. */
export function countMonthsCovered(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) +
    1
  );
}

/** Bornes (minuit UTC) du mois civil en cours à Abidjan. */
export function currentCivilMonthRange(): { from: Date; to: Date } {
  const today = parseDateOnlyToUTC(todayDateString())!;
  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
  );
  return { from, to };
}
