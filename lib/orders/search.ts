// lib/orders/search.ts
//
// Recherche d'une commande « au comptoir » : le livreur ou le client annonce à
// voix haute un code de retrait, un n° du jour, un numéro de téléphone ou un
// nom, et le staff doit retrouver la commande instantanément.
//
// Le parsing (`parseOrderSearchTerm`) est partagé entre :
//   - la caisse, qui filtre en mémoire la file du jour (`matchesOrderSearch`)
//   - la liste `/dashboard/commandes`, dont le `where` Prisma ne peut PAS
//     appeler un prédicat JS : elle ne réutilise que le terme parsé
//     (`digits`, `dailyNumber`) pour construire ses clauses SQL.
//
// Pur, sans dépendance Prisma ni React.

import { PHONE_SEARCH_MIN_DIGITS } from '@/config/constants';
import { getPickupCode } from '@/lib/orders/format';

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
};

/** Minuscules sans diacritiques : « Kouakou Axèl » → « kouakou axel ». */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

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

  return { raw, normalized, tokens, digits, dailyNumber };
}

/**
 * Vrai si la commande correspond au terme parsé. Les critères sont en OU :
 * code de retrait, référence, n° du jour, téléphone, nom.
 *
 * Téléphone : comparaison de sous-chaînes de CHIFFRES BRUTS, jamais via
 * `normalizeIvorianPhone` — celui-ci préfixe « 225 » et rejette les saisies de
 * moins de 12 chiffres, ce qui casserait la frappe partielle (« 0788 »). Le
 * brut fait matcher « 07 88 12 », « +225 07 88 12 » et « 0788 12 » sur un
 * `+22507881234567` stocké. Seuil `PHONE_SEARCH_MIN_DIGITS` pour éviter qu'un
 * terme de 1-2 chiffres ne matche tous les numéros.
 */
export function matchesOrderSearch(
  order: SearchableOrder,
  parsed: ParsedSearchTerm
): boolean {
  const { normalized, tokens, digits, dailyNumber } = parsed;

  // Code de retrait annoncé à l'oral (« A3F9 ») — le critère terrain n°1.
  if (fold(getPickupCode(order.reference)).includes(normalized)) return true;

  if (fold(order.reference).includes(normalized)) return true;

  if (dailyNumber !== null && order.dailyNumber === dailyNumber) return true;
  // « 003 » comme « 3 » : le n° est affiché sur 3 chiffres partout.
  if (
    digits.length > 0 &&
    String(order.dailyNumber).padStart(3, '0').includes(digits)
  ) {
    return true;
  }

  if (
    order.customerPhone &&
    digits.length >= PHONE_SEARCH_MIN_DIGITS &&
    order.customerPhone.replace(/\D/g, '').includes(digits)
  ) {
    return true;
  }

  // Nom : tous les mots doivent apparaître, dans n'importe quel ordre
  // (« axel kou » trouve « Kouakou Axel »).
  if (order.customerName && tokens.length > 0) {
    const name = fold(order.customerName);
    if (tokens.every((t) => name.includes(t))) return true;
  }

  return false;
}
