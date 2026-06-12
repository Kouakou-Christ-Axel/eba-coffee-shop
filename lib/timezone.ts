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

// ─── Helpers isomorphes (client + serveur, fuseau métier explicite) ───────────
//
// Les filtres de date du dashboard doivent produire le MÊME jour civil que celui
// stocké dans Order.dailyDate (@db.Date), quel que soit le fuseau du navigateur
// ou du runtime. On ancre donc le calcul sur le fuseau métier Abidjan via Intl.

/** Fuseau métier (Côte d'Ivoire, UTC+0, pas de DST). */
export const ABIDJAN_TZ = 'Africa/Abidjan';

/** Vérifie le format strict YYYY-MM-DD. */
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Date civile « aujourd'hui » à Abidjan, au format YYYY-MM-DD.
 * Fonctionne identiquement côté client et serveur (en-CA → YYYY-MM-DD).
 */
export function todayDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ABIDJAN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Parse une chaîne YYYY-MM-DD en Date à minuit UTC. Comme Abidjan = UTC+0, c'est
 * exactement la valeur stockée dans Order.dailyDate (@db.Date) — indépendamment
 * du fuseau du runtime (contrairement à `new Date(y, m-1, d)` qui est local).
 */
export function parseDateOnlyToUTC(
  value: string | undefined
): Date | undefined {
  if (!value) return undefined;
  const m = DATE_ONLY_RE.exec(value);
  if (!m) return undefined;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Décale une chaîne YYYY-MM-DD de `delta` jours et renvoie YYYY-MM-DD.
 * Arithmétique en UTC pour éviter tout franchissement de fuseau.
 */
export function shiftDateString(value: string, delta: number): string {
  const base = parseDateOnlyToUTC(value);
  if (!base) return value;
  base.setUTCDate(base.getUTCDate() + delta);
  return formatLocalDateOnly(base);
}
