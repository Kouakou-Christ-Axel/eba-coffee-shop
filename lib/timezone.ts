// Helpers de date pour le fuseau Abidjan (UTC+0, pas de DST).
// Comme Abidjan est à UTC sans décalage, on travaille en UTC en interne.
// Si l'app était déployée à un autre fuseau, ces helpers seraient le seul
// point à adapter.

const ABIDJAN_OFFSET_MS = 0;

function shift(d: Date, offsetMs: number): Date {
  return new Date(d.getTime() + offsetMs);
}

/** Tronque à 00:00 (heure locale Abidjan) et renvoie une nouvelle Date. */
export function startOfLocalDay(d: Date): Date {
  const local = shift(d, ABIDJAN_OFFSET_MS);
  const utcMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0,
    0,
    0,
    0
  );
  return new Date(utcMidnight - ABIDJAN_OFFSET_MS);
}

/** Renvoie la fin de journée locale (23:59:59.999). */
export function endOfLocalDay(d: Date): Date {
  const start = startOfLocalDay(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Format YYYY-MM-DD (jour civil local). Utilisé pour Order.dailyDate. */
export function formatLocalDateOnly(d: Date): string {
  const local = shift(d, ABIDJAN_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const day = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
