// Recherche des articles de dépense par la base (pg_trgm, cf.
// lib/search/trgm.ts). Servie par `GET /api/expenses/articles/search` ; le tri
// par usage reste dans `lib/expense-article-search.ts`.

import { Prisma } from '@/generated/prisma/client';
import { searchHits } from '@/lib/search/hits';

export function searchExpenseArticleHits(term: string) {
  return searchHits({
    term,
    columns: [{ sql: Prisma.sql`a.name` }],
    from: Prisma.sql`FROM expense_article a`,
    idColumn: Prisma.sql`a.id`,
  });
}
