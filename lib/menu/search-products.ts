// lib/menu/search-products.ts
//
// Recherche compacte de produits dans le menu admin (pure : testable sans base).
// Sert `search_products` (MCP + assistant) : `get_menu` renvoie tout le menu
// (suppléments globaux recopiés dans chaque produit) et dépasse vite toute
// limite de contexte ; ici, une ligne courte par produit.

import { createFuzzyIndex } from '@/lib/fuzzy-search';
import type { AdminMenuCategory } from '@/lib/menu/queries/admin';

export const SEARCH_PRODUCTS_LIMIT = 25;

export type ProductSearchRow = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  price: number;
  /** false = masqué du site public. */
  available: boolean;
  featured: boolean;
  /** ISO si le produit est en pause (retour automatique), sinon null. */
  pausedUntil: string | null;
  stockQuantity: number | null;
};

export type ProductSearchResult = {
  total: number;
  returned: number;
  products: ProductSearchRow[];
};

export function searchProducts(
  menu: AdminMenuCategory[],
  filters: { query?: string; categoryId?: string },
  limit = SEARCH_PRODUCTS_LIMIT
): ProductSearchResult {
  const rows: ProductSearchRow[] = menu
    .filter((c) => !filters.categoryId || c.id === filters.categoryId)
    .flatMap((c) =>
      c.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: c.name,
        categoryId: c.id,
        price: p.price,
        available: p.available,
        featured: p.featured,
        pausedUntil: p.unavailableUntil?.toISOString() ?? null,
        stockQuantity: p.stockQuantity,
      }))
    );

  const query = filters.query?.trim();
  const matched = query
    ? createFuzzyIndex(rows, {
        keys: [{ name: 'name', weight: 2 }, { name: 'category' }],
      })
        .search(query)
        .map((hit) => hit.item)
    : rows;

  return {
    total: matched.length,
    returned: Math.min(matched.length, limit),
    products: matched.slice(0, limit),
  };
}
