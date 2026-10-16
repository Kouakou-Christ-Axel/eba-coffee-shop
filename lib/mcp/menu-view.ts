// lib/mcp/menu-view.ts
//
// Vue « économe » du menu pour `get_menu` : un modèle faible n'a besoin que des
// `id`, noms, prix et stocks pour 95 % des gestes. Le détail complet (planning,
// suppléments, options) reste disponible à la demande (`detail: 'full'` ou
// `productId`) — sans quoi les groupes globaux étaient recopiés dans CHAQUE
// produit.

import { createFuzzyIndex } from '@/lib/fuzzy-search';
import type {
  AdminMenuCategory,
  AdminMenuProduct,
} from '@/lib/menu/queries/admin';

export type MenuViewOptions = {
  categoryId?: string;
  productId?: string;
  search?: string;
  detail?: 'compact' | 'full';
};

type Row = {
  category: AdminMenuCategory;
  product: AdminMenuProduct;
  name: string;
  categoryName: string;
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
  { categoryId, productId, search, detail = 'compact' }: MenuViewOptions
) {
  const full = detail === 'full' || Boolean(productId);

  let rows: Row[] = menu
    .filter((c) => !categoryId || c.id === categoryId)
    .flatMap((category) =>
      category.products.map((product) => ({
        category,
        product,
        name: product.name,
        categoryName: category.name,
      }))
    );
  if (productId) rows = rows.filter((r) => r.product.id === productId);
  if (search?.trim()) {
    const index = createFuzzyIndex(rows, {
      keys: [{ name: 'name', weight: 2 }, { name: 'categoryName' }],
    });
    rows = index.search(search).map((hit) => hit.item);
  }

  // Regroupe par catégorie (ordre d'apparition conservé).
  const byCategory = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byCategory.get(row.category.id) ?? [];
    list.push(row);
    byCategory.set(row.category.id, list);
  }

  // Catégories vides conservées uniquement sans filtre produit/recherche :
  // `create_product` en a besoin pour cibler une catégorie neuve.
  const keepEmpty = !productId && !search?.trim();
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
