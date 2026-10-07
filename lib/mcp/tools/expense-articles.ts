// lib/mcp/tools/expense-articles.ts
//
// Outils MCP — expense-articles (extrait de lib/mcp/tools.ts, sans changement de comportement).

import { z } from 'zod';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  listExpenseArticles,
  getExpenseArticleHistory,
  getExpenseMonthlySeries,
  getPurchaseFrequency,
} from '@/lib/expenses';
import { resolveArticle } from '@/lib/expense-matching';
import { expenseFrequencyFiltersSchema } from '@/lib/schemas/expense';
import { getExpenseSettings } from '@/lib/expense-settings-db';
import { idSchema, rangeSchema, toRange } from './helpers';
import type { McpTool } from './types';

export const expenseArticlesTools: McpTool[] = [
  // — Dépenses : articles (référentiel, rapprochement, fréquence d'achat) —
  {
    name: 'search_article',
    toolset: 'finance',
    scope: 'finance',
    title: 'Rechercher un article de dépense',
    description:
      'Recherche/rapproche un libellé (`q`) avec le référentiel d’articles ' +
      '(`ExpenseArticle`) : alias scopé fournisseur → alias global → nom ' +
      'normalisé exact → candidats approchants (jusqu’à 5). `supplierId` (clé ' +
      'fournisseur) affine le rapprochement par alias scopé. Ne crée jamais ' +
      'd’article — utile avant `create_expense`/`relink_expense_item` pour ' +
      'trouver l’`articleId` correct.',
    inputSchema: z.object({
      q: z.string().min(1),
      supplierId: z.string().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { q, supplierId } = args as { q: string; supplierId?: string };
      return resolveArticle({ rawLabel: q, supplierKey: supplierId });
    },
  },
  {
    name: 'detect_article',
    toolset: 'finance',
    scope: 'finance',
    title: 'Détecter l’article correspondant à un libellé',
    description:
      'Même rapprochement que `search_article`, pensé pour qu’une IA décide ' +
      'AVANT de créer une ligne de dépense : la réponse contient soit un ' +
      'article rapproché avec certitude (`matched`), soit plusieurs candidats ' +
      'ambigus à départager explicitement (`candidates`), soit aucune ' +
      'correspondance (`none`, il faudra alors laisser `create_expense` ' +
      '(`items[].articleName`) créer un nouvel article).',
    inputSchema: z.object({
      q: z.string().min(1),
      supplierId: z.string().optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { q, supplierId } = args as { q: string; supplierId?: string };
      return resolveArticle({ rawLabel: q, supplierKey: supplierId });
    },
  },
  {
    name: 'get_purchase_frequency',
    toolset: 'finance',
    scope: 'finance',
    title: 'Fréquence d’achat par article',
    description:
      'Nombre d’achats (COMPTAGE recalculé à chaque appel, jamais un compteur ' +
      'stocké), montant cumulé, prix unitaire moyen pondéré, intervalle moyen ' +
      'entre deux achats (jours) et cadence mensuelle. `articleId` restreint à ' +
      'un seul article (omis = tous les articles achetés sur la période). ' +
      'Période (`from`/`to`, `YYYY-MM-DD`) optionnelle : défaut le mois civil ' +
      'Abidjan en cours.',
    inputSchema: expenseFrequencyFiltersSchema.extend({
      articleId: idSchema.optional(),
    }),
    readOnly: true,
    handler: (args) => {
      const { articleId, from, to } = args as {
        articleId?: string;
        from?: string;
        to?: string;
      };
      return getPurchaseFrequency(articleId, {
        from: parseDateOnlyToUTC(from),
        to: parseDateOnlyToUTC(to),
      });
    },
  },
  {
    name: 'list_expense_articles',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les articles de dépense',
    description:
      'Renvoie les articles de dépense actifs (référentiel de rapprochement), ' +
      'triés par nom, avec unité de base, suivi de stock, emplacement, lien ' +
      'inventaire, prix de référence grossiste et nombre de lignes ' +
      'rattachées. `search` filtre par nom (auto-complétion/désambiguïsation).',
    inputSchema: z.object({ search: z.string().optional() }),
    readOnly: true,
    handler: (args) =>
      listExpenseArticles((args as { search?: string }).search),
  },
  {
    name: 'get_expense_article_history',
    toolset: 'finance',
    scope: 'finance',
    title: 'Historique d’achat d’un article',
    description:
      'Renvoie le détail de chaque ligne d’achat d’un article (drill-down), ' +
      'les plus récentes d’abord, avec la dépense associée (reçu, date, ' +
      'fournisseur, mode de paiement). Plage `from`/`to` (`YYYY-MM-DD`) ' +
      'optionnelle. Renvoie `null` si l’article est introuvable.',
    inputSchema: expenseFrequencyFiltersSchema.extend({ articleId: idSchema }),
    readOnly: true,
    handler: (args) => {
      const { articleId, from, to } = args as {
        articleId: string;
        from?: string;
        to?: string;
      };
      return getExpenseArticleHistory(articleId, {
        from: parseDateOnlyToUTC(from),
        to: parseDateOnlyToUTC(to),
      });
    },
  },
  {
    name: 'get_expense_monthly_series',
    toolset: 'finance',
    scope: 'finance',
    title: 'Série mensuelle des dépenses',
    description:
      'Renvoie, mois par mois sur la plage demandée (mois sans dépense inclus ' +
      'à zéro), le total des dépenses éclaté fixes/variables (nature de la ' +
      'catégorie). Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getExpenseMonthlySeries(from, to);
    },
  },
  {
    name: 'get_expense_settings',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lire les réglages du module dépenses',
    description:
      'Renvoie la configuration du module dépenses : fenêtre et seuil de ' +
      'fréquence d’achat, montant cumulé minimal, facteur de détection de ' +
      'prix aberrant, durée de vie d’un brouillon et seuil de suggestion de ' +
      'récurrence.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getExpenseSettings(),
  },
];
