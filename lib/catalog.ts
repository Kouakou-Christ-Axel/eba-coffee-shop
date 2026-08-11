// lib/catalog.ts
//
// Helpers purs du catalogue produits de la CAISSE (`dashboard/caisse/new`).
// Pas de dépendance Prisma ni React : testables en isolation.
//
// Deux besoins, tous deux liés au fait que la caisse est un poste tactile où
// chaque tap compte :
//   1. `productNeedsPicker` — décider si un tap doit ouvrir le sélecteur de
//      suppléments ou ajouter directement au panier.
//   2. `searchProducts` — retrouver un produit par son nom sans parcourir les
//      onglets de catégorie.

import { matchesProductSearch, parseMenuSearchTerm } from '@/lib/menu-display';
import type { MenuCategory, Product, SupplementGroup } from '@/config/menu';

/**
 * Le sélecteur de suppléments est-il INDISPENSABLE pour ce produit ?
 *
 * Pourquoi ce n'est pas simplement « le produit a des suppléments » :
 * `getMenu()` (lib/menu.ts) ajoute les groupes « Extras » GLOBAUX aux
 * `supplements` de **tous** les produits. Tester `supplements.length > 0`
 * revenait donc à ouvrir une modale pour chaque produit — même un jus sans
 * option — dès qu'un seul extra global existait en base.
 *
 * Le sélecteur n'est réellement requis que si :
 *   - un groupe est `required` (le caissier DOIT choisir), ou
 *   - un groupe est propre au produit (`!isGlobal`) : c'est une déclinaison du
 *     produit (taille, goût…), pas un supplément optionnel transverse.
 *
 * Les extras globaux restent atteignables via le bouton « Options » de la
 * tuile — cf. `product-catalog.tsx`.
 */
export function productNeedsPicker(product: Product): boolean {
  return (product.supplements ?? []).some(
    (group: SupplementGroup) => group.required || !group.isGlobal
  );
}

/** Le produit a-t-il des options atteignables (donc un bouton « Options ») ? */
export function productHasOptions(product: Product): boolean {
  return (product.supplements?.length ?? 0) > 0;
}

/**
 * Produit indisponible à la vente : le caissier ne doit pas pouvoir l'ajouter.
 * `soldOut` est déjà calculé par `getMenu()` ; on retombe sur `remaining` pour
 * les appelants qui ne passeraient pas par lui.
 */
export function isProductSoldOut(product: Product): boolean {
  if (product.soldOut) return true;
  const remaining = product.remaining ?? product.stockQuantity;
  return remaining !== null && remaining !== undefined && remaining <= 0;
}

/** Produit trouvé par la recherche, avec la catégorie d'origine pour l'affichage. */
export type CatalogSearchHit = {
  product: Product;
  categoryName: string;
};

/**
 * Recherche un produit dans TOUT le menu, insensible à la casse et aux accents
 * (« creme » trouve « Crème »). Chaque mot doit apparaître, dans n'importe quel
 * ordre — « choco chaud » trouve « Chocolat chaud ».
 *
 * S'appuie sur le moteur de la carte publique (`lib/menu-display.ts`) plutôt
 * que d'en réimplémenter un : une recherche qui replierait les accents d'un
 * côté et pas de l'autre donnerait deux résultats différents pour la même
 * frappe, selon qu'on est client ou caissier.
 *
 * Retourne `null` quand le terme est trop court pour être exploitable
 * (`CARTE_SEARCH_MIN_CHARS`) : l'appelant affiche alors les onglets de
 * catégorie normaux, pas une liste vide.
 */
export function searchProducts(
  menu: MenuCategory[],
  term: string
): CatalogSearchHit[] | null {
  const parsed = parseMenuSearchTerm(term);
  if (!parsed) return null;

  const hits: CatalogSearchHit[] = [];
  for (const category of menu) {
    for (const product of category.products) {
      if (matchesProductSearch(product, category.name, parsed)) {
        hits.push({ product, categoryName: category.name });
      }
    }
  }
  return hits;
}
