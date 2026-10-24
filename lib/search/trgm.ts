// lib/search/trgm.ts
//
// Recherche textuelle de l'app, faite par PostgreSQL (extensions `pg_trgm` et
// `unaccent`) : c'est le point d'entrée UNIQUE de toute recherche par nom.
// N'écris pas de `filter(...includes(...))` en mémoire ni de recherche Fuse :
// chaque surface déclare ses colonnes, la base filtre et classe.
//
// Règle de correspondance, par mot saisi (les mots sont indépendants de l'ordre,
// ET entre eux) et par colonne :
//
//   1. sous-chaîne (`LIKE '%mot%'`), accents et casse repliés — « cafe » trouve
//      « Café », « ouassi » trouve « Kouassi » ;
//   2. sinon, similarité trigramme (`word_similarity` ≥ `WORD_SIMILARITY_MIN`) —
//      c'est elle qui absorbe les fautes de frappe (« gobellet » → « Gobelet »).
//      Sous `MIN_TYPO_TOKEN_LENGTH` caractères elle est coupée : 1-2 lettres
//      ressemblent à tout.
//
// Le score (0..1, plus haut = meilleur) vaut 1 pour une sous-chaîne, la
// similarité sinon, pondéré par colonne ; moyenne sur les mots. Il sert à classer.

import { Prisma } from '@/generated/prisma/client';
import { foldText } from '@/lib/text';

/** Colonne SQL interrogeable, avec son poids relatif (défaut 1). */
export type SearchColumn = { sql: Prisma.Sql; weight?: number };

/** Résultat de recherche tel qu'échangé entre l'API et les écrans. */
export type SearchHit = { id: string; score: number };

export const MIN_TYPO_TOKEN_LENGTH = 3;
export const WORD_SIMILARITY_MIN = 0.6;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Texte d'une colonne, sans accents ni casse (symétrique de `foldText`). */
const folded = (column: Prisma.Sql) =>
  Prisma.sql`unaccent(lower(coalesce(${column}, '')))`;

/** Mots de la saisie, repliés ; `[]` si rien d'exploitable. */
export function searchTokens(term: string): string[] {
  return foldText(term).split(/\s+/).filter(Boolean);
}

/**
 * Clauses `WHERE` et score d'une recherche, ou `null` si la saisie est vide.
 * À brancher dans une requête qui expose les colonnes de `columns`.
 */
export function trgmSearch(
  term: string,
  columns: SearchColumn[]
): { where: Prisma.Sql; score: Prisma.Sql } | null {
  const tokens = searchTokens(term);
  if (tokens.length === 0) return null;
  const maxWeight = Math.max(...columns.map((c) => c.weight ?? 1));

  const perToken = tokens.map((token) => {
    const typoTolerant = token.length >= MIN_TYPO_TOKEN_LENGTH;
    const perColumn = columns.map(({ sql, weight = 1 }) => {
      const text = folded(sql);
      const contains = Prisma.sql`${text} LIKE ${`%${escapeLike(token)}%`}::text ESCAPE '\\'`;
      const similarity = Prisma.sql`word_similarity(${token}::text, ${text})`;
      return {
        matches: typoTolerant
          ? Prisma.sql`(${contains} OR ${similarity} >= ${WORD_SIMILARITY_MIN})`
          : contains,
        score: typoTolerant
          ? Prisma.sql`${weight}::float8 * CASE WHEN ${contains} THEN 1 ELSE ${similarity} END`
          : Prisma.sql`${weight}::float8 * CASE WHEN ${contains} THEN 1 ELSE 0 END`,
      };
    });
    return {
      matches: Prisma.sql`(${Prisma.join(
        perColumn.map((c) => c.matches),
        ' OR '
      )})`,
      score: Prisma.sql`GREATEST(${Prisma.join(perColumn.map((c) => c.score))})`,
    };
  });

  return {
    where: Prisma.join(
      perToken.map((t) => t.matches),
      ' AND '
    ),
    score: Prisma.sql`((${Prisma.join(
      perToken.map((t) => t.score),
      ' + '
    )}) / ${tokens.length}::float8 / ${maxWeight}::float8)`,
  };
}
