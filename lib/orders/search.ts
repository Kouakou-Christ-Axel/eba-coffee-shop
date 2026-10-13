// lib/orders/search.ts
//
// Recherche d'une commande « au comptoir » : le livreur ou le client annonce à
// voix haute un code de retrait, un n° du jour, un numéro de téléphone ou un
// nom, et le staff doit retrouver la commande instantanément.
//
// Le parsing (`parseOrderSearchTerm`) est partagé entre :
//   - la caisse, qui filtre et classe en mémoire la file du jour
//     (`searchOrders` : code exact d'abord, et seul s'il existe)
//   - la liste `/dashboard/commandes`, dont le `where` Prisma ne peut PAS
//     appeler un prédicat JS : elle ne réutilise que le terme parsé
//     (`digits`, `dailyNumber`) pour construire ses clauses SQL.
//
// Pur, sans dépendance Prisma ni React.

import { PHONE_SEARCH_MIN_DIGITS } from '@/config/constants';
import { getPickupCode } from '@/lib/orders/format';
import { foldText as fold } from '@/lib/text';

/** Forme minimale d'une commande pour la recherche terrain. */
export type SearchableOrder = {
  reference: string;
  dailyNumber: number;
  customerName: string | null;
  customerPhone: string | null;
};

export type ParsedSearchTerm = {
  /** Terme saisi, simplement débarrassé des espaces de bord. */
  raw: string;
  /** Minuscules sans accents, espaces internes normalisés. */
  normalized: string;
  /** Mots du terme normalisé (recherche de nom en ET). */
  tokens: string[];
  /** Chiffres bruts du terme, sans séparateur ni indicatif. */
  digits: string;
  /** N° du jour quand le terme est purement numérique et plausible. */
  dailyNumber: number | null;
  /**
   * Vrai quand le terme ne contient AUCUNE lettre (chiffres et séparateurs de
   * numéro seulement). Les critères « chiffres » (n° du jour, téléphone) ne
   * s'appliquent qu'alors : un code de retrait comme « A3F9 » contient les
   * chiffres 3 et 9, qui ne sont pas un numéro et ramenaient du bruit.
   */
  numericOnly: boolean;
};

/**
 * Prépare un terme de recherche. Retourne `null` quand il n'y a rien
 * d'exploitable (chaîne vide ou uniquement des espaces) — l'appelant doit
 * alors afficher la liste normale plutôt qu'un résultat vide.
 */
export function parseOrderSearchTerm(term: string): ParsedSearchTerm | null {
  const raw = term.trim();
  if (!raw) return null;

  const normalized = fold(raw).replace(/\s+/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);
  const digits = raw.replace(/\D/g, '');

  // N° du jour : seulement si l'utilisateur a tapé un nombre seul (« 3 »,
  // « #003 » une fois le dièse retiré) — « 07 88 12 » est un téléphone.
  let dailyNumber: number | null = null;
  const numeric = raw.replace(/^#/, '');
  if (/^\d+$/.test(numeric)) {
    const n = Number(numeric);
    if (Number.isSafeInteger(n) && n > 0 && n <= 2_147_483_647) {
      dailyNumber = n;
    }
  }

  const numericOnly = /^[\d\s#+().-]+$/.test(raw);

  return { raw, normalized, tokens, digits, dailyNumber, numericOnly };
}

/**
 * Rang de pertinence d'une correspondance : plus bas = meilleur. Le code de
 * retrait ou la référence EXACTS valent `EXACT` — ils sont uniques, donc c'est
 * la commande cherchée sans ambiguïté.
 */
export const SEARCH_RANK = {
  EXACT: 0,
  DAILY_NUMBER: 1,
  CODE_PARTIAL: 2,
  PHONE: 3,
  NAME: 4,
  DAILY_NUMBER_PARTIAL: 5,
} as const;

/**
 * Meilleur rang de la commande pour le terme, ou `null` si elle ne correspond
 * pas. Les critères restent en OU (code de retrait, référence, n° du jour,
 * téléphone, nom) mais chacun a un rang, pour pouvoir trier les résultats.
 *
 * Téléphone : comparaison de sous-chaînes de CHIFFRES BRUTS, jamais via
 * `normalizeIvorianPhone` — celui-ci préfixe « 225 » et rejette les saisies de
 * moins de 12 chiffres, ce qui casserait la frappe partielle (« 0788 »). Le
 * brut fait matcher « 07 88 12 », « +225 07 88 12 » et « 0788 12 » sur un
 * `+22507881234567` stocké. Seuil `PHONE_SEARCH_MIN_DIGITS` pour éviter qu'un
 * terme de 1-2 chiffres ne matche tous les numéros.
 *
 * Critères « chiffres » (n° du jour, téléphone) : réservés aux termes sans
 * lettre (`numericOnly`). Sinon « A3F9 » ramenait les n° 039, 139, 390…
 */
export function rankOrderMatch(
  order: SearchableOrder,
  parsed: ParsedSearchTerm
): number | null {
  const { normalized, tokens, digits, dailyNumber, numericOnly } = parsed;
  const code = fold(getPickupCode(order.reference));
  const reference = fold(order.reference);
  // « #A3F9 » : le dièse est celui des n° du jour, on le tolère aussi ici.
  const needle = normalized.replace(/^#/, '');

  // Code de retrait annoncé à l'oral (« A3F9 ») — le critère terrain n°1.
  if (code === needle || reference === normalized) return SEARCH_RANK.EXACT;

  if (dailyNumber !== null && order.dailyNumber === dailyNumber) {
    return SEARCH_RANK.DAILY_NUMBER;
  }

  if (code.includes(needle) || reference.includes(normalized)) {
    return SEARCH_RANK.CODE_PARTIAL;
  }

  if (
    numericOnly &&
    order.customerPhone &&
    digits.length >= PHONE_SEARCH_MIN_DIGITS &&
    order.customerPhone.replace(/\D/g, '').includes(digits)
  ) {
    return SEARCH_RANK.PHONE;
  }

  // Nom : tous les mots doivent apparaître, dans n'importe quel ordre
  // (« axel kou » trouve « Kouakou Axel »).
  if (order.customerName && tokens.length > 0) {
    const name = fold(order.customerName);
    if (tokens.every((t) => name.includes(t))) return SEARCH_RANK.NAME;
  }

  // « 003 » comme « 3 » : le n° est affiché sur 3 chiffres partout.
  if (
    numericOnly &&
    digits.length > 0 &&
    String(order.dailyNumber).padStart(3, '0').includes(digits)
  ) {
    return SEARCH_RANK.DAILY_NUMBER_PARTIAL;
  }

  return null;
}

/** Vrai si la commande correspond au terme parsé (peu importe le rang). */
export function matchesOrderSearch(
  order: SearchableOrder,
  parsed: ParsedSearchTerm
): boolean {
  return rankOrderMatch(order, parsed) !== null;
}

/**
 * Commandes correspondant au terme, de la plus pertinente à la moins
 * pertinente (tri stable : à rang égal, l'ordre d'entrée est conservé).
 *
 * Si au moins une commande a un code de retrait ou une référence EXACTS, on ne
 * renvoie QUE celles-là : le code est unique, tout le reste est du bruit. Sans
 * ça, taper le bon code ramenait aussi des homonymes partiels, souvent placés
 * AVANT la commande cherchée dans la file.
 */
export function searchOrders<T extends SearchableOrder>(
  orders: readonly T[],
  parsed: ParsedSearchTerm
): T[] {
  const ranked: { order: T; rank: number }[] = [];
  for (const order of orders) {
    const rank = rankOrderMatch(order, parsed);
    if (rank !== null) ranked.push({ order, rank });
  }
  const exact = ranked.filter((r) => r.rank === SEARCH_RANK.EXACT);
  const kept = exact.length > 0 ? exact : ranked;
  return kept
    .map((r, index) => ({ ...r, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((r) => r.order);
}
