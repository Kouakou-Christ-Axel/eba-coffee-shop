// lib/mcp/tools/expense-maintenance.ts
//
// Outils MCP — maintenance des lignes de dépense (rematch, backfill, relink).

import { z } from 'zod';
import {
  renameExpenseArticle,
  setExpenseArticleSettings,
  mergeArticles,
  relinkExpenseItem,
  backfillExpenseItems,
  rematchUnlinkedItems,
} from '@/lib/expense-mutations';
import {
  expenseArticleRenameSchema,
  expenseArticleSettingsSchema,
  articleMergeSchema,
  relinkExpenseItemSchema,
} from '@/lib/schemas/expense';
import {
  getExpenseSettings,
  updateExpenseSettings,
} from '@/lib/expense-settings-db';
import { expenseSettingsSchema } from '@/lib/expense-settings';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const expenseMaintenanceTools: McpTool[] = [
  {
    name: 'relink_expense_item',
    toolset: 'finance',
    scope: 'finance',
    title: 'Re-lier une ligne de dépense à un article',
    description:
      'Re-lie une ligne de dépense (`itemId`) à l’article correct ' +
      '(`articleId`) — corrige un rapprochement erroné ou absent — et ' +
      'APPREND l’alias (`rawLabel` → article) pour que la prochaine saisie du ' +
      'même libellé se rapproche automatiquement. Sans effet sur le stock.',
    inputSchema: relinkExpenseItemSchema,
    readOnly: false,
    handler: (args) => {
      const { itemId, articleId } = args as {
        itemId: string;
        articleId: string;
      };
      return relinkExpenseItem(itemId, articleId);
    },
  },
  {
    name: 'merge_articles',
    toolset: 'finance',
    scope: 'finance',
    title: 'Fusionner deux articles en doublon',
    description:
      'Fusionne `sourceId` dans `targetId` (dédoublonnage) : toutes les ' +
      'lignes de dépense et tous les alias pointant vers la source sont ' +
      're-rattachés à la cible, puis la source est archivée. Ne supprime ' +
      'jamais de ligne.',
    inputSchema: articleMergeSchema,
    readOnly: false,
    handler: (args) => {
      const { sourceId, targetId } = args as {
        sourceId: string;
        targetId: string;
      };
      return mergeArticles(sourceId, targetId);
    },
  },
  {
    name: 'rename_expense_article',
    toolset: 'finance',
    scope: 'finance',
    title: 'Renommer un article de dépense',
    description:
      'Met à jour le nom d’un article de dépense (le nom normalisé suit ; ' +
      'unicité contrôlée).',
    inputSchema: expenseArticleRenameSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return renameExpenseArticle(id, rest);
    },
  },
  {
    name: 'set_expense_article_settings',
    toolset: 'finance',
    scope: 'finance',
    title: 'Régler un article de dépense',
    description:
      'Met à jour de façon PARTIELLE les réglages d’un article : `baseUnit` ' +
      '(unité de base pour normaliser les quantités), `trackInventory` (le ' +
      'lie au module inventaire), `location` (emplacement de stockage), ' +
      '`wholesaleRefPrice` (prix de référence grossiste, francs CFA) et ' +
      '`inventoryItemId` (référence d’inventaire liée).',
    inputSchema: expenseArticleSettingsSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return setExpenseArticleSettings(id, rest);
    },
  },
  {
    name: 'update_expense_settings',
    toolset: 'finance',
    scope: 'finance',
    title: 'Modifier les réglages du module dépenses',
    description:
      'Met à jour la configuration du module dépenses (fenêtre et seuil de ' +
      'fréquence d’achat, montant cumulé minimal, facteur de prix aberrant, ' +
      'durée de vie d’un brouillon, seuil de suggestion de récurrence). ' +
      'Renvoie les réglages mis à jour.',
    inputSchema: expenseSettingsSchema,
    readOnly: false,
    handler: async (args) => {
      await updateExpenseSettings(args);
      return getExpenseSettings();
    },
  },
  {
    name: 'rematch_expense_items',
    toolset: 'finance',
    scope: 'finance',
    title: 'Rapprocher les lignes non liées',
    description:
      'Outil d’ENTRETIEN : passe en revue les lignes de dépense non ' +
      'rapprochées (`articleId` manquant) et tente de les relier via le même ' +
      'moteur que `search_article` — lie automatiquement en cas de ' +
      'correspondance UNIQUE (alias ou nom normalisé exact) et apprend ' +
      'l’alias correspondant, laisse de côté les lignes ambiguës (plusieurs ' +
      'candidats) ou sans correspondance. Utilise `dryRun: true` pour un ' +
      'aperçu (compte les lignes qui seraient liées/ambiguës/sans ' +
      'correspondance) AVANT d’appliquer réellement. `supplierKey` force la ' +
      'clé fournisseur (sinon dérivée du fournisseur de chaque dépense).',
    inputSchema: z.object({
      dryRun: z.boolean().optional(),
      supplierKey: z.string().optional(),
    }),
    readOnly: false,
    handler: (args) => {
      const { dryRun, supplierKey } = args as {
        dryRun?: boolean;
        supplierKey?: string;
      };
      return rematchUnlinkedItems(undefined, { dry: dryRun, supplierKey });
    },
  },
  {
    name: 'backfill_expense_items',
    toolset: 'finance',
    scope: 'finance',
    title: 'Régénérer le détail des dépenses liées aux réappros',
    description:
      'Outil d’ENTRETIEN : génère rétroactivement les lignes de détail ' +
      '(`ExpenseItem`) des dépenses liées à des achats d’inventaire ' +
      '(`record_inventory_purchases`) qui n’en ont pas encore. Idempotent — ' +
      'ne traite que les dépenses sans détail existant — et ne modifie ' +
      'JAMAIS le montant de la dépense : les dépenses dont la somme des ' +
      'achats ne correspond pas exactement sont ignorées et rapportées ' +
      '(`skippedMismatch`). Utilise `dryRun: true` pour un aperçu avant ' +
      'd’appliquer.',
    inputSchema: z.object({ dryRun: z.boolean().optional() }),
    readOnly: false,
    handler: (args) => {
      const { dryRun } = args as { dryRun?: boolean };
      return backfillExpenseItems(undefined, { dry: dryRun });
    },
  },
];
