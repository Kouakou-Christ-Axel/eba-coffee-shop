// Recherche des références d'inventaire par la base (pg_trgm, cf.
// lib/search/trgm.ts). Servie par `GET /api/inventory/search` ; le classement
// métier (stock bas d'abord…) reste dans `lib/inventory-item-search.ts`.

import { Prisma } from '@/generated/prisma/client';
import { searchHits } from '@/lib/search/hits';

export function searchInventoryItemHits(term: string) {
  return searchHits({
    term,
    columns: [
      { sql: Prisma.sql`i.name` },
      { sql: Prisma.sql`i.sku`, weight: 0.5 },
      { sql: Prisma.sql`i.category`, weight: 0.3 },
    ],
    from: Prisma.sql`FROM inventory_item i`,
    idColumn: Prisma.sql`i.id`,
  });
}
