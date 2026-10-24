// lib/search/hits.ts
//
// Exécution d'une recherche `trgmSearch` sur une table et renvoi des ids classés.
// Sert les routes de recherche (inventaire, articles de dépense) et les outils
// MCP du menu.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { trgmSearch, type SearchColumn, type SearchHit } from './trgm';

/** Plafond de résultats d'une recherche : bien au-delà de ce qu'un écran affiche. */
export const SEARCH_HITS_LIMIT = 200;

/**
 * `SELECT <idColumn> AS id, <score> AS score <from> WHERE <recherche>`, meilleurs
 * résultats d'abord. `from` porte la table ET ses jointures
 * (`FROM product p JOIN menu_category c ON …`).
 */
export async function searchHits({
  term,
  columns,
  from,
  idColumn,
}: {
  term: string;
  columns: SearchColumn[];
  from: Prisma.Sql;
  idColumn: Prisma.Sql;
}): Promise<SearchHit[]> {
  const search = trgmSearch(term, columns);
  if (!search) return [];
  const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
    SELECT ${idColumn} AS id, ${search.score} AS score
    ${from} WHERE ${search.where}
    ORDER BY score DESC, id LIMIT ${SEARCH_HITS_LIMIT}`;
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}
