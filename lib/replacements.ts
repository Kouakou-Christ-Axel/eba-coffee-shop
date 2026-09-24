// lib/replacements.ts
//
// Alternatives proposées quand un article du panier est épuisé aujourd'hui
// (panneau « Résoudre » du checkout, cf. `sold-out-resolver.tsx`). Le but est
// de garder un retrait AUJOURD'HUI : « Remplacer » est l'action mise en avant,
// parce que c'est la vente la plus sûre — le client a faim maintenant.
//
// Pur (aucun accès réseau/DOM) : le menu vient de `/api/menu`.

import type { MenuCategory, Product } from '@/config/menu';
import {
  isAvailableToday,
  isPausedNow,
  isWithinAnyPeriod,
} from '@/lib/supplements';

/** Nombre d'alternatives affichées par ligne épuisée. */
export const REPLACEMENT_MAX = 3;

type LineToReplace = {
  productId: string;
  /** Prix unitaire de la ligne — sert à proposer d'abord un prix proche. */
  basePrice: number;
  quantity: number;
};

/**
 * Commandable pour un retrait IMMÉDIAT en quantité `quantity` : ni en pause,
 * ni épuisé (stock suffisant), dans son planning du jour et sa fenêtre
 * « spécialité », sans délai de commande à l'avance ni acompte (ces deux-là
 * renverraient le client vers un autre jour ou le comptoir — le contraire de
 * ce qu'il cherche en remplaçant).
 */
export function isReplacementCandidate(
  product: Product,
  quantity: number,
  now: Date = new Date()
): boolean {
  return (
    product.soldOut !== true &&
    (product.remaining == null || product.remaining >= quantity) &&
    !isPausedNow(product.unavailableUntil, now) &&
    isAvailableToday(product.availableDays, now) &&
    isWithinAnyPeriod(product.weeklySpecialPeriods, now) &&
    !((product.advanceOrderDays ?? 0) > 0) &&
    !product.requiresDeposit
  );
}

/**
 * Jusqu'à `max` produits pour remplacer `line`, dans cet ordre :
 *   1. même catégorie que l'article épuisé (même envie : un gâteau pour un
 *      gâteau), puis le reste de la carte en complément ;
 *   2. dans chaque groupe, rang de vente d'abord (preuve sociale, quand
 *      `popularRank` est connu), puis le prix le plus proche.
 * `excludeProductIds` écarte le produit épuisé lui-même et ce qui est déjà
 * dans le panier (proposer un doublon ne résout rien).
 */
export function selectReplacementProducts(
  menu: MenuCategory[],
  line: LineToReplace,
  {
    excludeProductIds = [],
    max = REPLACEMENT_MAX,
    now = new Date(),
  }: { excludeProductIds?: string[]; max?: number; now?: Date } = {}
): Product[] {
  const excluded = new Set([line.productId, ...excludeProductIds]);
  const sameCategory =
    menu.find((c) => c.products.some((p) => p.id === line.productId))
      ?.products ?? [];

  const byRelevance = (a: Product, b: Product) => {
    const rankA = a.popularRank ?? Infinity;
    const rankB = b.popularRank ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    return (
      Math.abs(a.price - line.basePrice) - Math.abs(b.price - line.basePrice)
    );
  };
  const eligible = (p: Product) =>
    !excluded.has(p.id) && isReplacementCandidate(p, line.quantity, now);

  const first = sameCategory.filter(eligible).sort(byRelevance);
  if (first.length >= max) return first.slice(0, max);

  const taken = new Set(first.map((p) => p.id));
  const rest = menu
    .flatMap((c) => c.products)
    .filter((p) => !taken.has(p.id) && eligible(p))
    .sort(byRelevance);
  return [...first, ...rest].slice(0, max);
}
