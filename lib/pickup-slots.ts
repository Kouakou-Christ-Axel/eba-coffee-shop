import {
  DEFAULT_SETTINGS,
  getRangesForDay,
  type PickupSettings,
} from '@/lib/pickup-settings';
import { formatLocalDateOnly } from '@/lib/timezone';

/**
 * Pure: generates pickup slot candidates from settings.
 * A slot is included only if its timestamp is >= now + leadTimeMin minutes.
 * Does NOT enforce per-slot capacity — use getAvailablePickupSlots (server-only).
 */
export function generatePickupSlots(
  now: Date,
  settings: PickupSettings = DEFAULT_SETTINGS
): Date[] {
  const slots: Date[] = [];
  const minTime = now.getTime() + settings.leadTimeMin * 60_000;
  const intervalMs = settings.slotIntervalMin * 60_000;

  for (let dayOffset = 0; dayOffset < settings.visibleDays; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const ranges = getRangesForDay(day, settings);
    for (const range of ranges) {
      const [startH, startM] = range.start.split(':').map(Number);
      const [endH, endM] = range.end.split(':').map(Number);

      const rangeStart = new Date(day);
      rangeStart.setHours(startH, startM, 0, 0);
      const rangeEnd = new Date(day);
      rangeEnd.setHours(endH, endM, 0, 0);

      for (
        let t = rangeStart.getTime();
        t <= rangeEnd.getTime();
        t += intervalMs
      ) {
        if (t >= minTime) {
          slots.push(new Date(t));
        }
      }
    }
  }

  return slots;
}

/**
 * Créneau à pré-sélectionner pour un retrait « à partir de tel jour, vers telle
 * heure ». Pur, donc testable seul.
 *
 * Pourquoi ce n'est pas un simple `new Date(jour + heure)` : l'heure voulue
 * n'est PAS forcément un créneau réel. Le commerce peut être fermé à ce
 * moment-là, le pas de créneau peut tomber à côté, le délai de préparation
 * peut l'exclure, ou la capacité peut être pleine. Poser une valeur qui
 * n'existe pas dans la liste ferait afficher un créneau que le client ne
 * pourrait jamais valider.
 *
 * Stratégie : l'heure exacte si elle existe ; sinon le créneau le plus proche
 * APRÈS (on ne fait pas venir le client plus tôt que ce qu'on lui a proposé) ;
 * sinon le plus proche avant ; sinon le premier créneau d'un jour suivant.
 * `null` si aucun créneau n'est disponible du tout.
 */
export function pickDefaultSlot(
  slots: Date[],
  fromDay: string,
  preferredTime: string
): Date | null {
  const eligible = slots
    .filter((s) => formatLocalDateOnly(s) >= fromDay)
    .sort((a, b) => a.getTime() - b.getTime());
  if (eligible.length === 0) return null;

  const firstDay = formatLocalDateOnly(eligible[0]);
  const sameDay = eligible.filter((s) => formatLocalDateOnly(s) === firstDay);

  const [h, m] = preferredTime.split(':').map(Number);
  const target = new Date(sameDay[0]);
  target.setHours(h, m ?? 0, 0, 0);
  const targetMs = target.getTime();

  return (
    sameDay.find((s) => s.getTime() === targetMs) ??
    sameDay.find((s) => s.getTime() > targetMs) ??
    // Rien après : le dernier créneau du jour est le plus proche avant.
    sameDay[sameDay.length - 1]
  );
}
