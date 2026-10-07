// lib/mcp/tools/inventory.ts
//
// Outils MCP — inventaire périodique (références, réappro, comptages, réglages).

import { z } from 'zod';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  listInventoryItems,
  getInventoryItem,
  getInventorySummary,
  listLowStockItems,
  listInventoryPurchases,
  listInventoryCounts,
  getInventoryCount,
} from '@/lib/inventory';
import {
  createInventoryItem,
  updateInventoryItem,
  archiveInventoryItem,
  batchRestock,
  cancelRestockBatch,
  recordInventoryCount,
} from '@/lib/inventory-mutations';
import {
  getInventorySettings,
  updateInventorySettings,
} from '@/lib/inventory-settings-db';
import {
  inventoryItemUpdateSchema,
  batchRestockSchema,
  batchCountSchema,
  inventoryFiltersSchema,
  inventoryItemInputSchema,
} from '@/lib/schemas/inventory';
import { inventorySettingsSchema } from '@/lib/inventory-settings';
import { idSchema, dateOnly } from './helpers';
import type { McpTool } from './types';

export const inventoryTools: McpTool[] = [
  // — Inventaire (matières premières & consommables) —
  {
    name: 'list_inventory_items',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Lister les références d’inventaire',
    description:
      'Renvoie les références d’inventaire (matières premières et consommables) ' +
      'avec leur `id`, `sku`, unité, stock courant, PMP (prix moyen pondéré), ' +
      'valeur de stock et seuils. Filtres optionnels : `search` (nom ou SKU), ' +
      '`category`, `lowStockOnly` (uniquement les références sous le seuil) et ' +
      '`active` (true = actives, false = archivées). Utilise les `id` renvoyés ' +
      'pour cibler les autres outils d’inventaire.',
    inputSchema: inventoryFiltersSchema,
    readOnly: true,
    handler: (args) => listInventoryItems(args as never),
  },
  {
    name: 'get_inventory_item',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Détail d’une référence d’inventaire',
    description:
      'Renvoie une référence d’inventaire avec ses achats récents et les lignes ' +
      'de comptage associées. Renvoie null si introuvable.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getInventoryItem((args as { id: string }).id),
  },
  {
    name: 'get_inventory_summary',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Synthèse de l’inventaire',
    description:
      'Renvoie les KPIs de l’inventaire : nombre de références actives, références ' +
      'sous le seuil, valeur totale du stock (PMP) et références jamais comptées. ' +
      'Montants en francs CFA.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getInventorySummary(),
  },
  {
    name: 'list_low_stock_items',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Références sous le seuil',
    description:
      'Renvoie les références d’inventaire dont le stock courant est inférieur ou ' +
      'égal au seuil (seuil de réappro ou stock de sécurité). À réapprovisionner.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listLowStockItems(),
  },
  {
    name: 'list_inventory_purchases',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Lister les achats d’inventaire',
    description:
      'Renvoie les achats/réapprovisionnements d’inventaire (entrées de stock) ' +
      'filtrés par plage de dates (`from`/`to`, `YYYY-MM-DD`, jour civil Abidjan) ' +
      'et/ou `itemId`, avec le total. Tous les filtres sont optionnels. ' +
      'Quantités décimales, montants en francs CFA.',
    inputSchema: z.object({
      from: dateOnly.optional().describe('Jour de début (inclus), YYYY-MM-DD.'),
      to: dateOnly.optional().describe('Jour de fin (inclus), YYYY-MM-DD.'),
      itemId: idSchema.optional().describe('Référence ciblée (cf. liste).'),
    }),
    readOnly: true,
    handler: (args) => {
      const f = args as { from?: string; to?: string; itemId?: string };
      return listInventoryPurchases({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        itemId: f.itemId,
      });
    },
  },
  {
    name: 'list_inventory_counts',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Lister les comptages d’inventaire',
    description:
      'Renvoie l’historique des comptages périodiques d’inventaire (inventaires ' +
      'physiques), les plus récents d’abord.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listInventoryCounts(),
  },
  {
    name: 'get_inventory_count',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Détail d’un comptage d’inventaire',
    description:
      'Renvoie le rapport d’un comptage périodique pour la période concernée : par ' +
      'référence, stock initial, entrées (achats), stock final compté, sorties ' +
      '(consommation déduite) et valorisation au PMP. Renvoie null si introuvable.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: true,
    handler: (args) => getInventoryCount((args as { id: string }).id),
  },
  {
    name: 'create_inventory_item',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Créer une référence d’inventaire',
    description:
      'Crée une référence d’inventaire (matière première ou consommable). Le ' +
      '`sku` est GÉNÉRÉ par le système (ne pas le fournir). `name` est le ' +
      'libellé. `unit` ∈ UNIT/KG/G/L/ML/BOX (défaut ' +
      'UNIT). `safetyStock` (stock de sécurité) et `reorderPoint` (seuil de ' +
      'réappro) sont optionnels. `category`, `supplier`, `notes` optionnels. Pour ' +
      'un stock d’ouverture, renseigne `initialQuantity` et `initialUnitCost` (en ' +
      'francs CFA) — un comptage initial est créé et initialise le PMP. ' +
      'Quantités décimales.',
    inputSchema: inventoryItemInputSchema,
    readOnly: false,
    handler: (args) => createInventoryItem(args),
  },
  {
    name: 'update_inventory_item',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Modifier une référence d’inventaire',
    description:
      'Met à jour une référence d’inventaire de façon PARTIELLE : ne fournis que ' +
      'les champs à modifier (nom, unité, catégorie, seuils, fournisseur, notes, ' +
      'statut actif). Le stock courant et le PMP ne se modifient pas ici — passe ' +
      'par un achat (`record_inventory_purchases`) ou un comptage ' +
      '(`record_inventory_count`).',
    inputSchema: inventoryItemUpdateSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateInventoryItem(id, rest);
    },
  },
  {
    name: 'archive_inventory_item',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Archiver une référence d’inventaire',
    description:
      'Archive une référence d’inventaire (suppression douce : la référence est ' +
      'masquée mais son historique est conservé).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => archiveInventoryItem((args as { id: string }).id),
  },
  {
    name: 'record_inventory_purchases',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Enregistrer un réapprovisionnement',
    description:
      'Enregistre un réapprovisionnement par lot (entrées de stock). `date` au ' +
      'format `YYYY-MM-DD`. `lines` liste les références (`itemId`) avec une ' +
      '`quantity` (décimale) et un `unitCost` (coût unitaire en francs CFA) ; le ' +
      'stock et le PMP de chaque référence sont mis à jour. `supplier` optionnel. ' +
      'Si `createExpense` est true, une dépense liée du montant total est créée ' +
      '(fournis alors `expenseCategoryId`). Renvoie le lot créé.',
    inputSchema: batchRestockSchema,
    readOnly: false,
    handler: (args) => batchRestock(args),
  },
  {
    name: 'cancel_restock_batch',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Annuler un lot de réapprovisionnement',
    description:
      'Annule un lot de réapprovisionnement entier : restaure le stock et le PMP ' +
      'antérieurs de chaque référence et supprime la dépense liée éventuelle. ' +
      'Refusé si un comptage postérieur au lot existe. `batchId` provient de ' +
      'l’historique des achats/lots.',
    inputSchema: z.object({ batchId: idSchema }),
    readOnly: false,
    handler: (args) =>
      cancelRestockBatch((args as { batchId: string }).batchId),
  },
  {
    name: 'record_inventory_count',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Enregistrer un comptage d’inventaire',
    description:
      'Enregistre un comptage périodique (inventaire physique). `date` au format ' +
      '`YYYY-MM-DD`, `label` optionnel. `lines` liste les références (`itemId`) ' +
      'avec la quantité réellement comptée (décimale). La consommation de la ' +
      'période est déduite automatiquement (stock initial + achats − stock final) ' +
      'et le stock courant est aligné sur le compté.',
    inputSchema: batchCountSchema,
    readOnly: false,
    handler: (args) => recordInventoryCount(args),
  },
  {
    name: 'get_inventory_settings',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Lire les réglages d’inventaire',
    description:
      'Renvoie la configuration du module d’inventaire (rappel de comptage ' +
      'périodique, fréquence, etc.).',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getInventorySettings(),
  },
  {
    name: 'update_inventory_settings',
    toolset: 'inventaire',
    scope: 'finance',
    title: 'Modifier les réglages d’inventaire',
    description:
      'Met à jour la configuration du module d’inventaire. Renvoie les réglages ' +
      'mis à jour.',
    inputSchema: inventorySettingsSchema,
    readOnly: false,
    handler: async (args) => {
      await updateInventorySettings(args);
      return getInventorySettings();
    },
  },
];
