// lib/expense-article-search.ts
//
// Couche métier de la recherche d'articles de dépense, au-dessus de
// `lib/fuzzy-search.ts` : type canonique transmis au formulaire, tri « ce qu'on
// achète le plus » quand aucune requête n'est saisie, et tie-break stable.
//
// Nommage plat volontaire (pas `lib/expenses/…`) : un répertoire `lib/expenses/`
// entrerait en collision avec le fichier `lib/expenses.ts` pour l'alias
// `@/lib/expenses`.
//
// Pur : aucune dépendance Prisma ni React. Le rapprochement SERVEUR (alias,
// `resolveArticle`) vit dans `lib/expense-matching.ts` et reste indépendant —
// Fuse ne sert qu'à la saisie, sur des données déjà transmises au client.

import { createFuzzyIndex, type FuzzyIndex } from '@/lib/fuzzy-search';
import { foldText } from '@/lib/text';

/** Article du référentiel, tel que consommé par le formulaire de dépense. */
export type ExpenseArticleOption = {
  id: string;
  name: string;
  baseUnit: string | null;
  trackInventory: boolean;
  /**
   * Prix moyen pondéré PAR UNITÉ DE BASE (`baseUnit`), pas par unité de saisie
   * — cf. `getExpenseArticleStats`. Toute réutilisation dans un champ « prix
   * unitaire » doit passer par `convertUnitPrice`.
   */
  lastUnitPrice: number | null;
  /** Nombre de lignes d'achat sur tout l'historique (`_count.items`). */
  usageCount: number;
  /** Dernier achat (YYYY-MM-DD), `null` si jamais acheté. */
  lastPurchaseDate: string | null;
};

/**
 * Clé de comparaison EXACTE de deux noms d'articles (« ce nom existe-t-il
 * déjà ? »). Équivalente à `normalizeLabel` de `lib/expense-matching.ts`, qui
 * n'est pas importable ici : ce module-là tire `@/lib/prisma` et ne peut donc
 * pas franchir la frontière client.
 */
export function normalizeArticleKey(value: string): string {
  return foldText(value).trim().replace(/\s+/g, ' ');
}

/** Index de recherche des articles — à mémoïser sur la référence du tableau. */
export function createArticleIndex(
  articles: readonly ExpenseArticleOption[]
): FuzzyIndex<ExpenseArticleOption> {
  return createFuzzyIndex(articles, { keys: [{ name: 'name' }] });
}

const nameCollator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Ordre du catalogue quand aucune requête n'est saisie : ce qu'on achète le
 * plus souvent d'abord, puis le plus récemment acheté, puis l'alphabet.
 */
export function compareArticlesByUsage(
  a: ExpenseArticleOption,
  b: ExpenseArticleOption
): number {
  if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
  const dateA = a.lastPurchaseDate ?? '';
  const dateB = b.lastPurchaseDate ?? '';
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  return nameCollator.compare(a.name, b.name);
}

/**
 * Arrondi du score Fuse pour le tri. Sans lui, deux articles quasi équivalents
 * permutent visuellement d'une frappe à l'autre : des écarts de score
 * insignifiants domineraient le critère métier.
 */
function scoreBucket(score: number): number {
  return Math.round(score * 100) / 100;
}

/**
 * Point d'entrée du combobox de saisie.
 *
 * Requête vide ⇒ le référentiel trié par usage (c'est ce qui permet de VOIR les
 * articles existants sans rien taper). Sinon les résultats Fuse, réordonnés par
 * le tie-break métier : score arrondi, puis usage, puis alphabet.
 */
export function rankArticles(
  index: FuzzyIndex<ExpenseArticleOption>,
  articles: readonly ExpenseArticleOption[],
  query: string,
  options?: { limit?: number }
): ExpenseArticleOption[] {
  const limit = options?.limit;

  if (query.trim().length === 0) {
    const sorted = [...articles].sort(compareArticlesByUsage);
    return limit == null ? sorted : sorted.slice(0, limit);
  }

  return index
    .search(query, limit)
    .sort((a, b) => {
      const bucketA = scoreBucket(a.score);
      const bucketB = scoreBucket(b.score);
      if (bucketA !== bucketB) return bucketA - bucketB;
      return compareArticlesByUsage(a.item, b.item);
    })
    .map((hit) => hit.item);
}
