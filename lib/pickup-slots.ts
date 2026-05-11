import {
  DEFAULT_SETTINGS,
  getRangesForDay,
  type PickupSettings,
} from '@/lib/pickup-settings';

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
