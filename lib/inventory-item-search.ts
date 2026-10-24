// lib/inventory-item-search.ts
//
// Classement des références d'inventaire. La recherche elle-même est faite par la
// base (`lib/inventory-search.ts`, pg_trgm) ; ce module applique ses résultats à
// la liste chargée et départage selon le métier — décalqué de
// `lib/expense-article-search.ts`.
//
// Deux propriétés comptent autant l'une que l'autre :
//
//   1. **Requête vide ⇒ tout le catalogue, classé utilement.** C'est ce qui
//      permet de parcourir sans taper. Le `Select` qu'on remplace listait bien
//      les 117 références, mais dans un ordre sans rapport avec ce qu'on
//      cherche : sur un écran de réappro, ce sont les références sous le seuil
//      qu'on vient saisir.
//   2. **Un classement stable.** Le score est arrondi avant le départage métier
//      (`rankByHits`), sinon deux références quasi équivalentes permutent
//      visuellement à chaque frappe.
//
// Pur : ni React, ni Prisma.

import { rankByHits } from '@/lib/search/rank';
import type { SearchHit } from '@/lib/search/trgm';

export type InventoryItemOption = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  currentQuantity: number;
  safetyStock: number;
  reorderPoint: number | null;
  isLowStock: boolean;
};

/** Seuil effectif : le point de réappro prime sur le stock de sécurité. */
export function thresholdOf(item: {
  safetyStock: number;
  reorderPoint: number | null;
}): number {
  return item.reorderPoint === null ? item.safetyStock : item.reorderPoint;
}

/**
 * Quantité à commander pour repasser au-dessus du seuil.
 *
 * `null` quand la référence n'a pas de seuil — et c'est le cas de la très
 * grande majorité du catalogue réel. Renvoyer `0` serait un mensonge présenté
 * comme une suggestion : on préfère ne rien proposer.
 */
export function suggestRestockQuantity(item: {
  currentQuantity: number;
  safetyStock: number;
  reorderPoint: number | null;
}): number | null {
  const threshold = thresholdOf(item);
  if (threshold <= 0) return null;
  const missing = threshold - item.currentQuantity;
  if (missing <= 0) return null;
  // Les quantités sont en Decimal(12,3) : on garde trois décimales utiles.
  return Math.round(missing * 1000) / 1000;
}

/**
 * Ordre par défaut d'un écran de réappro : ce qui manque d'abord, puis
 * l'urgence relative, puis l'alphabet.
 */
export function compareForRestock(
  a: InventoryItemOption,
  b: InventoryItemOption
): number {
  if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
  if (a.isLowStock && b.isLowStock) {
    const byUrgency = urgencyRatio(a) - urgencyRatio(b);
    if (byUrgency !== 0) return byUrgency;
  }
  return a.name.localeCompare(b.name, 'fr');
}

/**
 * Part du seuil encore couverte : 0 = rayon vide, 1 = pile au seuil. Sert à
 * trier « le plus urgent d'abord » plutôt que par quantité absolue — il manque
 * plus gravement 2 gobelets sur un seuil de 4 que 8 sur un seuil de 100.
 */
export function urgencyRatio(item: InventoryItemOption): number {
  const threshold = thresholdOf(item);
  if (threshold <= 0) return Number.POSITIVE_INFINITY;
  return item.currentQuantity / threshold;
}

/**
 * Références classées pour une requête. Requête vide ⇒ tout le catalogue dans
 * l'ordre de `compareForRestock`. `hits` : résultats de la base pour la requête
 * (`null` tant qu'ils ne sont pas arrivés : on garde alors le catalogue entier).
 */
export function rankInventoryItems(
  hits: readonly SearchHit[] | null,
  items: readonly InventoryItemOption[],
  query: string,
  options: { limit?: number } = {}
): InventoryItemOption[] {
  const ranked =
    query.trim() === '' || hits === null
      ? [...items].sort(compareForRestock)
      : rankByHits(items, hits, compareForRestock);

  return options.limit === undefined ? ranked : ranked.slice(0, options.limit);
}
