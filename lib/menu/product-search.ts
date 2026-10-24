// Recherche des produits du menu par la base (pg_trgm, cf. lib/search/trgm.ts) :
// nom du produit (poids 2) ou de sa catégorie. Alimente `search_products` et
// le filtre `search` de `get_menu` (MCP + assistant).

import { Prisma } from '@/generated/prisma/client';
import { searchHits } from '@/lib/search/hits';

export function searchProductHits(term: string) {
  return searchHits({
    term,
    columns: [
      { sql: Prisma.sql`p.name`, weight: 2 },
      { sql: Prisma.sql`c.name` },
    ],
    from: Prisma.sql`FROM product p JOIN menu_category c ON c.id = p."categoryId"`,
    idColumn: Prisma.sql`p.id`,
  });
}
