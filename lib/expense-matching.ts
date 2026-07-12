// lib/expense-matching.ts
//
// Rapprochement des lignes de dépense (`ExpenseItem.rawLabel`) avec le
// référentiel d'articles (`ExpenseArticle`) : normalisation insensible aux
// accents (le point que #79 avait omis — « Café » et « Cafe » doivent matcher),
// dédup/auto-création, résolution par alias/nom, et apprentissage d'alias.
//
// Ordre de résolution (`resolveArticle`) : alias scopé fournisseur → alias
// global → nom normalisé exact → candidats approchants (`contains`). Ne crée
// JAMAIS d'article (contrairement à `ensureArticle`, dédié à la saisie libre).

import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import type { ExpenseArticle } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export type Article = ExpenseArticle;

type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Clé de rapprochement : minuscules, décomposition NFD + suppression des
 * marques diacritiques (accents), trim, espaces multiples réduits à un seul.
 * « Café », « CAFE », « cafe  » et « Café » normalisent tous vers « cafe ».
 * Utilisé PARTOUT où deux libellés doivent être comparés (articles, alias,
 * fournisseurs) — ne jamais comparer des chaînes brutes.
 */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Clé de fournisseur normalisée (ou `null` si absente/vide). */
export function normalizeSupplierKey(s?: string | null): string | null {
  if (!s) return null;
  const normalized = normalizeLabel(s);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Retrouve (par nom normalisé) ou crée l'article désigné par `rawLabel`. Un
 * article archivé portant le même nom normalisé est ressuscité (`archivedAt`
 * remis à `null`) plutôt que de créer un doublon. Ne fait AUCUN rapprochement
 * par alias — c'est le rôle de `resolveArticle` ; `ensureArticle` sert la
 * saisie libre (créer si besoin, dédupliquer sinon).
 */
export async function ensureArticle(
  tx: Prisma.TransactionClient,
  rawLabel: string
): Promise<Article> {
  const name = rawLabel.trim();
  const normalizedName = normalizeLabel(name);
  const existing = await tx.expenseArticle.findUnique({
    where: { normalizedName },
  });
  if (existing) {
    if (existing.archivedAt) {
      return tx.expenseArticle.update({
        where: { id: existing.id },
        data: { archivedAt: null },
      });
    }
    return existing;
  }
  return tx.expenseArticle.create({ data: { name, normalizedName } });
}

export type ArticleResolution =
  | { matched: Article }
  | { candidates: Article[] }
  | { none: true };

const MAX_CANDIDATES = 5;

/**
 * Résout `rawLabel` (+ `supplierKey` optionnel) vers un article existant, SANS
 * jamais en créer un nouveau. Ordre :
 *   1. Alias scopé au fournisseur (`ArticleAlias(alias, supplierKey)`)
 *   2. Alias global (`ArticleAlias(alias, null)`)
 *   3. Nom normalisé exact (`ExpenseArticle.normalizedName`)
 *   4. Candidats approchants (`contains`, jusqu'à 5 articles non archivés)
 * `client` est injectable pour rester utilisable dans une transaction.
 */
export async function resolveArticle(
  { rawLabel, supplierKey }: { rawLabel: string; supplierKey?: string | null },
  client: Queryable = prisma
): Promise<ArticleResolution> {
  const normalized = normalizeLabel(rawLabel);
  const supplier = normalizeSupplierKey(supplierKey);

  if (supplier) {
    const scoped = await client.articleAlias.findFirst({
      where: { alias: normalized, supplierKey: supplier },
      include: { article: true },
    });
    if (scoped) return { matched: scoped.article };
  }

  const global = await client.articleAlias.findFirst({
    where: { alias: normalized, supplierKey: null },
    include: { article: true },
  });
  if (global) return { matched: global.article };

  const exact = await client.expenseArticle.findUnique({
    where: { normalizedName: normalized },
  });
  if (exact) return { matched: exact };

  const candidates = await client.expenseArticle.findMany({
    where: { archivedAt: null, normalizedName: { contains: normalized } },
    orderBy: { name: 'asc' },
    take: MAX_CANDIDATES,
  });
  if (candidates.length > 0) return { candidates };

  return { none: true };
}

/**
 * Enregistre (ou met à jour) l'alias `(alias, supplierKey)` → `articleId`.
 * Idempotent : ré-appeler avec le même alias ne crée pas de doublon. On
 * cherche d'abord (`findFirst`) plutôt que `upsert` sur la clé composée car
 * Postgres traite NULL comme distinct dans un index unique — deux lignes
 * `(alias, supplierKey: null)` identiques ne violeraient PAS la contrainte, et
 * `ON CONFLICT` ne se déclencherait donc pas pour les alias sans fournisseur.
 */
export async function learnAlias(
  tx: Prisma.TransactionClient,
  {
    alias,
    supplierKey,
    articleId,
  }: { alias: string; supplierKey?: string | null; articleId: string }
): Promise<void> {
  const normalizedAlias = normalizeLabel(alias);
  const key = normalizeSupplierKey(supplierKey);

  const existing = await tx.articleAlias.findFirst({
    where: { alias: normalizedAlias, supplierKey: key },
  });
  if (existing) {
    if (existing.articleId !== articleId) {
      await tx.articleAlias.update({
        where: { id: existing.id },
        data: { articleId },
      });
    }
    return;
  }
  await tx.articleAlias.create({
    data: { alias: normalizedAlias, supplierKey: key, articleId },
  });
}
