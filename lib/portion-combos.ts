// lib/portion-combos.ts
//
// « Les plus prises » : répartitions de parts réellement choisies par des
// clients sur une boîte à contenu fixe (« Oreo ×2 · Coco ×1 — 34 fois »),
// proposées en un appui dans le composeur.
//
// C'est l'équivalent du « Most popular » d'Uber Eats, mais adossé aux commandes
// passées plutôt qu'à une saisie manuelle : rien à tenir à jour, et la
// suggestion suit les modes toute seule. Surtout, c'est le seul remède au coût
// d'une grande boîte — remplir 8 parts demande 8 gestes, une combinaison en
// demande UN.
//
// Agrégation à partir de `Order.items[].supplements`, qui enregistre déjà le
// couple (goût, quantité) de chaque ligne : aucune donnée nouvelle à collecter.

import type {
  MenuCategory,
  PortionCombo,
  SupplementGroup,
} from '@/config/menu';
import type { CartItemInput } from '@/lib/schemas/order';
import { isFixedPortionGroup, portionCount } from '@/lib/supplements';
import {
  PORTION_COMBO_MAX,
  PORTION_COMBO_MIN_ORDERS,
} from '@/config/constants';

/** Signature stable d'une répartition, indépendante de l'ordre de saisie. */
function comboKey(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, qty]) => qty > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, qty]) => `${name}:${qty}`)
    .join('|');
}

/**
 * Répartitions les plus fréquentes par produit, à partir des lignes de commande
 * de la fenêtre. Une ligne = une décision de composition : une commande de 3
 * boîtes identiques compte pour UNE fois (c'est bien un seul choix du client).
 *
 * Seules les boîtes COMPLÈTES sont retenues : une répartition partielle (état
 * historique où `minSelect` était plus bas que la taille de la boîte) ne peut
 * pas être reproposée en un appui sans laisser des parts vides.
 */
export function aggregatePortionCombos(
  menu: MenuCategory[],
  items: CartItemInput[]
): Map<string, PortionCombo[]> {
  // Groupes à parts fixes du menu courant, par produit — on n'agrège que ce qui
  // est encore proposé aujourd'hui.
  const groupsByProduct = new Map<string, SupplementGroup[]>();
  for (const category of menu) {
    for (const product of category.products) {
      const fixed = (product.supplements ?? []).filter(isFixedPortionGroup);
      if (fixed.length > 0) groupsByProduct.set(product.id, fixed);
    }
  }
  if (groupsByProduct.size === 0) return new Map();

  // productId → groupName → signature → { counts, orders }
  const tally = new Map<string, Map<string, PortionCombo>>();

  for (const item of items) {
    const groups = groupsByProduct.get(item.productId);
    if (!groups) continue;

    for (const group of groups) {
      const counts: Record<string, number> = {};
      let total = 0;
      for (const supplement of item.supplements) {
        if (supplement.groupName !== group.name) continue;
        const qty = supplement.quantity ?? 1;
        counts[supplement.optionName] =
          (counts[supplement.optionName] ?? 0) + qty;
        total += qty;
      }
      // Boîte incomplète (ou goûts d'un autre groupe) : inexploitable.
      if (total !== portionCount(group)) continue;

      const key = `${group.name}::${comboKey(counts)}`;
      const perProduct = tally.get(item.productId) ?? new Map();
      const existing = perProduct.get(key);
      if (existing) existing.orders += 1;
      else perProduct.set(key, { groupName: group.name, counts, orders: 1 });
      tally.set(item.productId, perProduct);
    }
  }

  const result = new Map<string, PortionCombo[]>();
  for (const [productId, perProduct] of tally) {
    const combos = [...perProduct.values()]
      .filter((c) => c.orders >= PORTION_COMBO_MIN_ORDERS)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, PORTION_COMBO_MAX);
    if (combos.length > 0) result.set(productId, combos);
  }
  return result;
}

/** Fusionne les répartitions populaires dans un menu public. */
export function attachPortionCombos(
  menu: MenuCategory[],
  combos: Map<string, PortionCombo[]>
): MenuCategory[] {
  if (combos.size === 0) return menu;
  return menu.map((category) => ({
    ...category,
    products: category.products.map((product) => {
      const found = combos.get(product.id);
      return found ? { ...product, portionCombos: found } : product;
    }),
  }));
}

/**
 * Une répartition n'est proposable que si chacun de ses goûts existe encore,
 * est disponible, et a le stock nécessaire. Sans ce filtre on proposerait en un
 * appui une boîte que le panier refuserait de composer.
 */
export function isComboAvailable(
  combo: PortionCombo,
  group: SupplementGroup
): boolean {
  return Object.entries(combo.counts).every(([name, qty]) => {
    const option = group.options.find((o) => o.name === name);
    if (!option || option.soldOut) return false;
    return option.remaining == null || option.remaining >= qty;
  });
}
