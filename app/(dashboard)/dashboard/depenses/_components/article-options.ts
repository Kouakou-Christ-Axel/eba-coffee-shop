// Chargement serveur du référentiel d'articles pour le formulaire de dépense :
// nom, unité de base, prix moyen et usage, en une seule source pour toutes les
// surfaces de saisie.
//
// `cache()` est nécessaire, pas cosmétique : `listExpenseArticles` est déjà
// mémoïsé, mais PAS `getExpenseArticleStats` — sa signature à objet de filtres
// empêche de la mémoïser directement. Envelopper un helper sans argument donne
// une mémoïsation parfaite par requête.

import { cache } from 'react';
import { listExpenseArticles, getExpenseArticleStats } from '@/lib/expenses';
import type { ExpenseArticleOption } from '@/lib/expense-article-search';

export const loadArticleOptions = cache(
  async function loadArticleOptions(): Promise<ExpenseArticleOption[]> {
    const [articles, stats] = await Promise.all([
      listExpenseArticles(),
      // Non filtré (tout l'historique) : le prix moyen sert de repère de saisie,
      // il doit rester utile même hors de la période affichée à l'écran.
      getExpenseArticleStats({}),
    ]);

    const statByArticle = new Map(stats.map((stat) => [stat.articleId, stat]));

    return articles.map((article) => {
      const stat = statByArticle.get(article.id);
      return {
        id: article.id,
        name: article.name,
        baseUnit: article.baseUnit,
        trackInventory: article.trackInventory,
        lastUnitPrice: stat?.avgUnitPrice ?? null,
        usageCount: article._count.items,
        lastPurchaseDate: stat?.lastPurchaseDate ?? null,
      };
    });
  }
);
