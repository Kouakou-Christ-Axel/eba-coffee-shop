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

// ─── Bucketing mensuel (stats dépenses) ────────────────────────────────────────

/** Mois civil 'YYYY-MM' d'une Date (Abidjan = UTC → composantes UTC). */
export function monthKeyFromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

/**
 * Liste des mois civils 'YYYY-MM' couverts (inclus) par une plage de Dates —
 * sert à remplir les mois vides à zéro dans les séries mensuelles.
 */
export function listMonthKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1);
  while (cursor.getTime() <= end) {
    keys.push(monthKeyFromDate(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

/**
 * Bornes (à minuit UTC, cohérentes avec les colonnes @db.Date) du mois civil
 * en cours à Abidjan — plage par défaut des stats de fréquence d'achat.
 */
export function currentMonthRange(): { from: Date; to: Date } {
  const today = parseDateOnlyToUTC(todayDateString())!;
  const from = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );
  const to = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
  );
  return { from, to };
}

// ─── Créneaux de retrait : datetime-local ⇄ instant, ancrés Abidjan ────────────
//
// Le widget <input type="datetime-local"> n'a AUCUNE notion de fuseau : sa valeur
// « YYYY-MM-DDTHH:mm » est une heure « murale » brute. Pour un commerce mono-site
// (Abidjan, UTC+0), on interprète TOUJOURS cette heure comme Abidjan et on
// l'affiche TOUJOURS en Abidjan — indépendamment du fuseau du navigateur ou du
// serveur. Sans cela, un environnement hors UTC introduit un décalage (ex. +2h)
// entre la saisie et la relecture. Comme Abidjan = UTC, l'heure murale Abidjan
// correspond directement aux composantes UTC de l'instant.

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Valeur d'un <input datetime-local> (heure Abidjan) → ISO 8601 (UTC).
 * Chaîne vide ou invalide → null.
 */
export function abidjanDatetimeLocalToISO(value: string): string | null {
  const m = LOCAL_DT_RE.exec(value);
  if (!m) return null;
  const d = new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5])
    )
  );
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Instant (ISO ou Date) → valeur d'un <input datetime-local> en heure Abidjan.
 * null/invalide → chaîne vide. Composantes UTC (Abidjan = UTC), donc résultat
 * identique côté serveur et navigateur.
 */
export function isoToAbidjanDatetimeLocal(value: string | Date | null): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` +
    `T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
  );
}

/** Instant → « 10h00 » (heure Abidjan). Déterministe serveur + client. */
export function formatAbidjanTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: ABIDJAN_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(':', 'h');
}

/** Instant → « 23 juin » (jour + mois, heure Abidjan, sans année ni jour de
 * semaine) — version courte utilisée quand la date complète serait trop
 * verbeuse (ex. badge de reprise de pause sur la carte publique). */
export function formatAbidjanShortDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: ABIDJAN_TZ,
    day: 'numeric',
    month: 'long',
  }).format(d);
}

/** Instant → « lundi 23 juin · 10h00 » (heure Abidjan). */
export function formatAbidjanDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const dayMonth = new Intl.DateTimeFormat('fr-FR', {
    timeZone: ABIDJAN_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return `${dayMonth} · ${formatAbidjanTime(d)}`;
}
