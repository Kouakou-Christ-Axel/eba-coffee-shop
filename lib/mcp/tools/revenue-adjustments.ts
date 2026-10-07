// lib/mcp/tools/revenue-adjustments.ts
//
// Outils MCP — régularisations de recette.

import { z } from 'zod';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  listRevenueAdjustments,
  getRevenueAdjustmentSummary,
} from '@/lib/revenue-adjustments';
import {
  createRevenueAdjustment,
  updateRevenueAdjustment,
  deleteRevenueAdjustment,
} from '@/lib/revenue-adjustment-mutations';
import {
  revenueAdjustmentInputSchema,
  revenueAdjustmentObjectSchema,
  revenueAdjustmentFiltersSchema,
} from '@/lib/schemas/revenue-adjustment';
import { idSchema, rangeSchema, toRange } from './helpers';
import type { McpTool } from './types';

export const revenueAdjustmentsTools: McpTool[] = [
  // — Régularisations de recette (ajustement manuel du CA) —
  {
    name: 'list_revenue_adjustments',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les régularisations de recette',
    description:
      'Renvoie les régularisations de recette (ajustements manuels du CA, sans ' +
      'commande) filtrées par plage de dates (`from`/`to`, `YYYY-MM-DD`) et/ou ' +
      '`paymentMode` (CASH/WAVE/ORANGE_MONEY/OTHER), avec le total net. Montants signés ' +
      '(positif = recette ajoutée, négatif = retirée). Tous les filtres sont ' +
      'optionnels.',
    inputSchema: revenueAdjustmentFiltersSchema,
    readOnly: true,
    handler: (args) => {
      const f = args as {
        from?: string;
        to?: string;
        paymentMode?: 'CASH' | 'WAVE' | 'ORANGE_MONEY' | 'OTHER';
      };
      return listRevenueAdjustments({
        dateFrom: parseDateOnlyToUTC(f.from),
        dateTo: parseDateOnlyToUTC(f.to),
        paymentMode: f.paymentMode,
      });
    },
  },
  {
    name: 'get_revenue_adjustment_summary',
    toolset: 'finance',
    scope: 'finance',
    title: 'Synthèse des régularisations de recette',
    description:
      'Renvoie le total net des régularisations de recette et leur ventilation ' +
      'par mode de paiement sur une plage de dates. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getRevenueAdjustmentSummary(from, to);
    },
  },
  {
    name: 'create_revenue_adjustment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Créer une régularisation de recette',
    description:
      'Enregistre un ajustement manuel du CA SANS créer de commande (ventes non ' +
      'saisies en temps réel, anciennes commandes perdues…). `date` au format ' +
      '`YYYY-MM-DD`, `amount` en francs CFA entiers SIGNÉS (positif = ajout au ' +
      'CA, négatif = retrait), `paymentMode` ∈ CASH/WAVE/ORANGE_MONEY/OTHER (défaut CASH ; le ' +
      'mode CASH alimente la clôture de caisse). `note` (motif) optionnelle. ' +
      'L’ajustement remonte dans les statistiques et la clôture de caisse.',
    inputSchema: revenueAdjustmentInputSchema,
    readOnly: false,
    handler: (args) => createRevenueAdjustment(args),
  },
  {
    name: 'update_revenue_adjustment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Modifier une régularisation de recette',
    description:
      'Met à jour une régularisation de recette de façon PARTIELLE : ne fournis ' +
      'que les champs à modifier.',
    inputSchema: revenueAdjustmentObjectSchema
      .partial()
      .extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & Record<string, unknown>;
      return updateRevenueAdjustment(id, rest);
    },
  },
  {
    name: 'delete_revenue_adjustment',
    toolset: 'finance',
    scope: 'finance',
    title: 'Supprimer une régularisation de recette',
    description:
      'Supprime définitivement une régularisation de recette. Action irréversible.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteRevenueAdjustment((args as { id: string }).id),
  },
];
