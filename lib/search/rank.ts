// lib/search/rank.ts
//
// Applique des résultats de recherche (ids classés par la base) à une liste déjà
// chargée en mémoire. Pur : utilisable côté client comme côté serveur.

import type { SearchHit } from './trgm';

/** Éléments de `items` présents dans `hits`, dans l'ordre de `hits`. */
export function itemsByHits<T extends { id: string }>(
  items: readonly T[],
  hits: readonly SearchHit[]
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return hits.flatMap((hit) => {
    const item = byId.get(hit.id);
    return item ? [item] : [];
  });
}

/**
 * Score arrondi, pour départager par un critère métier. Sans arrondi, des
 * écarts de score insignifiants dominent ce critère et les résultats permutent
 * d'une frappe à l'autre.
 */
export function scoreBucket(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Éléments de `items` présents dans `hits`, par score arrondi décroissant puis
 * `tieBreak` (critère métier).
 */
export function rankByHits<T extends { id: string }>(
  items: readonly T[],
  hits: readonly SearchHit[],
  tieBreak: (a: T, b: T) => number
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return hits
    .flatMap((hit) => {
      const item = byId.get(hit.id);
      return item ? [{ item, bucket: scoreBucket(hit.score) }] : [];
    })
    .sort((a, b) =>
      a.bucket !== b.bucket ? b.bucket - a.bucket : tieBreak(a.item, b.item)
    )
    .map((x) => x.item);
}
