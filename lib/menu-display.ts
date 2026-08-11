// lib/menu-display.ts
//
// Mise en forme du menu POUR L'AFFICHAGE de la carte publique : tri par
// disponibilité, recherche textuelle et filtre « disponible maintenant ».
// Purement fonctionnel (ni React, ni Prisma) pour rester testable en node-env
// et importable des deux côtés de la frontière serveur/client.
//
// Répartition volontaire des responsabilités, à ne pas inverser :
//
//   - le TRI se fait côté SERVEUR (`carte-menu-section.tsx`). Il dépend de
//     `new Date()`, et /carte est en ISR : recalculé au rendu client il
//     produirait un ordre différent du HTML servi → mismatch d'hydratation.
//     Le client reçoit un tableau déjà trié.
//   - le FILTRE se fait côté CLIENT, après montage, à partir d'une saisie
//     utilisateur. Son état initial est toujours vide, donc le premier rendu
//     est identique au HTML servi et les 62 produits restent dans le HTML
//     initial (référencement + JSON-LD intacts).
//
// Ce module ne modifie jamais `getMenu()` : /api/menu, la caisse et l'accueil
// gardent l'ordre défini au dashboard.

import type { MenuCategory, Product } from '@/config/menu';
import { isOrderableNow } from '@/lib/supplements';
import { foldText } from '@/lib/text';
import { CARTE_SEARCH_MIN_CHARS } from '@/config/constants';

// ─── Tri par disponibilité ──────────────────────────────────────────────────

/**
 * Remonte les produits commandables en tête de chaque catégorie, en préservant
 * l'ordre du dashboard (`sortOrder`) à l'intérieur de chaque groupe.
 *
 * Motivation : une catégorie comme « Pâtisserie de la semaine » peut n'avoir
 * que 2 produits commandables sur 11. Sans ce tri, le client scrolle neuf
 * lignes qu'il ne peut pas commander avant d'atteindre ce qui est en vitrine.
 * Les produits non commandables restent VISIBLES avec leur motif (« Épuisé »,
 * « Revient le … ») — on ne masque rien, on ne fait que réordonner.
 *
 * Une catégorie entièrement commandable (ou entièrement indisponible) est
 * retournée PAR RÉFÉRENCE : le tableau du menu garde son identité quand rien
 * ne change, ce qui préserve les `useMemo` en aval.
 */
export function sortProductsForDisplay(
  menu: MenuCategory[],
  now: Date = new Date()
): MenuCategory[] {
  let changed = false;

  const categories = menu.map((category) => {
    const orderable: Product[] = [];
    const unorderable: Product[] = [];
    category.products.forEach((p) =>
      (isOrderableNow(p, now) ? orderable : unorderable).push(p)
    );

    // Partition stable : rien à réordonner si tout est du même côté.
    if (orderable.length === 0 || unorderable.length === 0) return category;

    changed = true;
    return { ...category, products: [...orderable, ...unorderable] };
  });

  return changed ? categories : menu;
}

// ─── Recherche ──────────────────────────────────────────────────────────────

export type ParsedMenuSearch = {
  /** Minuscules sans accents, espaces internes normalisés. */
  normalized: string;
  /** Mots du terme normalisé — la recherche les combine en ET. */
  tokens: string[];
};

/**
 * Prépare un terme de recherche, ou `null` s'il n'y a rien d'exploitable.
 *
 * Le seuil `CARTE_SEARCH_MIN_CHARS` évite qu'un seul caractère ne vide la page
 * dès la première frappe : tant qu'il n'est pas atteint, l'appelant affiche la
 * carte complète.
 */
export function parseMenuSearchTerm(term: string): ParsedMenuSearch | null {
  const normalized = foldText(term.trim()).replace(/\s+/g, ' ');
  if (normalized.length < CARTE_SEARCH_MIN_CHARS) return null;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  return { normalized, tokens };
}

/**
 * Vrai si le produit correspond au terme. Tous les mots doivent apparaître,
 * dans n'importe quel ordre (« nutella crepe » trouve « Crêpe Nutella »), au
 * choix dans le nom, la description ou le nom de la catégorie — chercher
 * « chocolat » doit ramener la catégorie « Tout chocolat » en entier.
 *
 * Même stratégie que `matchesOrderSearch` (lib/orders/search.ts) : sous-chaînes
 * repliées, pas de recherche floue. Sur 62 produits, une lib de fuzzy search
 * coûterait plus (poids du bundle, score à calibrer) qu'elle ne rapporterait.
 */
export function matchesProductSearch(
  product: Product,
  categoryName: string,
  parsed: ParsedMenuSearch
): boolean {
  const haystack = foldText(
    `${product.name} ${product.description ?? ''} ${categoryName}`
  );
  return parsed.tokens.every((token) => haystack.includes(token));
}

// ─── Filtrage ───────────────────────────────────────────────────────────────

export type MenuFilter = {
  term: string;
  onlyAvailable: boolean;
};

export type MenuView = {
  /** Catégories à afficher — celles devenues vides sont retirées. */
  categories: MenuCategory[];
  /** Vrai dès qu'un critère est actif (pilote l'annonce et les animations). */
  isFiltered: boolean;
  /** Produits affichés. */
  resultCount: number;
  /** Produits au total, filtre ignoré. */
  totalCount: number;
};

export function countProducts(menu: MenuCategory[]): number {
  return menu.reduce((sum, c) => sum + c.products.length, 0);
}

/**
 * Applique recherche et filtre de disponibilité. Sans critère actif, retourne
 * le menu PAR RÉFÉRENCE — le premier rendu client est alors strictement
 * identique au HTML servi.
 */
export function filterMenu(
  menu: MenuCategory[],
  filter: MenuFilter,
  now: Date = new Date()
): MenuView {
  const totalCount = countProducts(menu);
  const parsed = parseMenuSearchTerm(filter.term);
  const isFiltered = parsed !== null || filter.onlyAvailable;

  if (!isFiltered) {
    return {
      categories: menu,
      isFiltered: false,
      resultCount: totalCount,
      totalCount,
    };
  }

  const categories: MenuCategory[] = [];
  let resultCount = 0;

  menu.forEach((category) => {
    const products = category.products.filter((product) => {
      if (filter.onlyAvailable && !isOrderableNow(product, now)) return false;
      if (parsed && !matchesProductSearch(product, category.name, parsed)) {
        return false;
      }
      return true;
    });

    if (products.length === 0) return;
    resultCount += products.length;
    categories.push(
      products.length === category.products.length
        ? category
        : { ...category, products }
    );
  });

  return { categories, isFiltered: true, resultCount, totalCount };
}
