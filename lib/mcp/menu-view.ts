// lib/mcp/menu-view.ts
//
// Vue « économe » du menu pour `get_menu` : un modèle faible n'a besoin que des
// `id`, noms, prix et stocks pour 95 % des gestes. Le détail complet (planning,
// suppléments, options) reste disponible à la demande (`detail: 'full'` ou
// `productId`) — sans quoi les groupes globaux étaient recopiés dans CHAQUE
// produit.

import { itemsByHits } from '@/lib/search/rank';
import type { SearchHit } from '@/lib/search/trgm';
import type {
  AdminMenuCategory,
  AdminMenuProduct,
} from '@/lib/menu/queries/admin';

export type MenuViewOptions = {
  categoryId?: string;
  productId?: string;
  /** Résultats classés de la recherche par nom (`searchProductHits`) ; défini = recherche active. */
  searchHits?: readonly SearchHit[];
  detail?: 'compact' | 'full';
};

type Row = {
  /** Id du produit : clé de jointure avec les résultats de recherche. */
  id: string;
  category: AdminMenuCategory;
  product: AdminMenuProduct;
};

function compactProduct(p: AdminMenuProduct) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    available: p.available,
    stockQuantity: p.stockQuantity,
  };
}

function compactCategory(c: AdminMenuCategory) {
  return { id: c.id, name: c.name, available: c.available };
}

export function buildMenuView(
  menu: AdminMenuCategory[],
  { categoryId, productId, searchHits, detail = 'compact' }: MenuViewOptions
) {
  const full = detail === 'full' || Boolean(productId);

  let rows: Row[] = menu
    .filter((c) => !categoryId || c.id === categoryId)
    .flatMap((category) =>
      category.products.map((product) => ({
        id: product.id,
        category,
        product,
      }))
    );
  if (productId) rows = rows.filter((r) => r.product.id === productId);
  if (searchHits) rows = itemsByHits(rows, searchHits);

  // Regroupe par catégorie (ordre d'apparition conservé).
  const byCategory = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category.id) ?? [];
    list.push(row);
    byCategory.set(row.category.id, list);
  }

  // Catégories vides conservées uniquement sans filtre produit/recherche :
  // `create_product` en a besoin pour cibler une catégorie neuve.
  const keepEmpty = !productId && !searchHits;
  return menu
    .filter(
      (c) => byCategory.has(c.id) || (keepEmpty && c.products.length === 0)
    )
    .filter((c) => !categoryId || c.id === categoryId)
    .map((c) => {
      const products = (byCategory.get(c.id) ?? []).map((r) => r.product);
      return full
        ? { ...c, products }
        : { ...compactCategory(c), products: products.map(compactProduct) };
    });
}
