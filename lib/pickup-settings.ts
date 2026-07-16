import { z } from 'zod';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const timeRangeSchema = z
  .object({
    start: z.string().regex(TIME_REGEX, 'Format HH:MM'),
    end: z.string().regex(TIME_REGEX, 'Format HH:MM'),
  })
  .refine((r) => r.start < r.end, {
    message: "L'heure de fin doit être après celle de début",
  });

export const weeklyHoursSchema = z.record(
  z.string().regex(/^[0-6]$/, 'Jour invalide'),
  z.array(timeRangeSchema)
);

export const dateOverrideSchema = z.object({
  date: z.string().regex(DATE_REGEX, 'Format YYYY-MM-DD'),
  closed: z.boolean(),
  ranges: z.array(timeRangeSchema),
  note: z.string().max(120).optional(),
});

export const pickupSettingsSchema = z.object({
  slotIntervalMin: z.number().int().min(5).max(60),
  leadTimeMin: z.number().int().min(0).max(1440),
  visibleDays: z.number().int().min(1).max(14),
  capacityPerSlot: z.number().int().min(1).nullable(),
  weeklyHours: weeklyHoursSchema,
  dateOverrides: z.array(dateOverrideSchema),
  pickupAddress: z.string().max(200).nullable(),
  pickupMapsUrl: z.string().url('URL invalide').max(500).nullable(),
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type WeeklyHours = z.infer<typeof weeklyHoursSchema>;
export type DateOverride = z.infer<typeof dateOverrideSchema>;
export type PickupSettings = z.infer<typeof pickupSettingsSchema>;

// Aligné sur les horaires annoncés du site (config/brand.config.ts :
// « Lun - Dim : 7h30 - 21h30 »). Les horaires réels restent éditables dans
// /dashboard/parametres — ce défaut ne sert que tant que rien n'est enregistré.
const DEFAULT_RANGE: TimeRange = { start: '07:30', end: '21:30' };

export const DEFAULT_SETTINGS: PickupSettings = {
  slotIntervalMin: 15,
  leadTimeMin: 30,
  visibleDays: 2,
  capacityPerSlot: null,
  weeklyHours: {
    '0': [DEFAULT_RANGE],
    '1': [DEFAULT_RANGE],
    '2': [DEFAULT_RANGE],
    '3': [DEFAULT_RANGE],
    '4': [DEFAULT_RANGE],
    '5': [DEFAULT_RANGE],
    '6': [DEFAULT_RANGE],
  },
  dateOverrides: [],
  pickupAddress: null,
  pickupMapsUrl: null,
};

export const WEEKDAY_LABELS: Record<string, string> = {
  '1': 'Lundi',
  '2': 'Mardi',
  '3': 'Mercredi',
  '4': 'Jeudi',
  '5': 'Vendredi',
  '6': 'Samedi',
  '0': 'Dimanche',
};

export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getRangesForDay(
  day: Date,
  settings: PickupSettings
): TimeRange[] {
  const key = formatDateKey(day);
  const override = settings.dateOverrides.find((o) => o.date === key);
  if (override) {
    return override.closed ? [] : override.ranges;
  }
  const weekday = String(day.getDay());
  return settings.weeklyHours[weekday] ?? [];
}

const WEEK_ORDER = ['1', '2', '3', '4', '5', '6', '0'];

function serializeRanges(ranges: TimeRange[]): string {
  return ranges.map((r) => `${r.start}-${r.end}`).join(',');
}

/** "07:30" → "7h30" ; "21:00" → "21h" (affichage FR compact). */
function formatHourLabel(time: string): string {
  const [h, m] = time.split(':');
  const hour = String(Number(h));
  return m === '00' ? `${hour}h` : `${hour}h${m}`;
}

/**
 * Résume `weeklyHours` en une phrase lisible (ex. « Lun - Dim : 7h30 - 21h30 »
 * ou « Lun - Ven : 7h30 - 21h30 · Sam - Dim : 8h - 22h » si les horaires
 * varient). Affiché publiquement (contact, accueil, le lieu) à partir des
 * mêmes horaires que ceux configurés pour le retrait — pas de second jeu
 * d'horaires à maintenir séparément.
 */
export function summarizeWeeklyHours(weeklyHours: WeeklyHours): string {
  const groups: { start: string; end: string; ranges: TimeRange[] }[] = [];
  for (const day of WEEK_ORDER) {
    const ranges = weeklyHours[day] ?? [];
    const last = groups[groups.length - 1];
    if (last && serializeRanges(last.ranges) === serializeRanges(ranges)) {
      last.end = day;
    } else {
      groups.push({ start: day, end: day, ranges });
    }
  }

  return groups
    .map((g) => {
      const startLabel = WEEKDAY_LABELS[g.start].slice(0, 3);
      const endLabel = WEEKDAY_LABELS[g.end].slice(0, 3);
      const label =
        g.start === g.end ? startLabel : `${startLabel} - ${endLabel}`;
      const hours =
        g.ranges.length === 0
          ? 'Fermé'
          : g.ranges
              .map(
                (r) => `${formatHourLabel(r.start)} - ${formatHourLabel(r.end)}`
              )
              .join(', ');
      return `${label} : ${hours}`;
    })
    .join(' · ');
}
