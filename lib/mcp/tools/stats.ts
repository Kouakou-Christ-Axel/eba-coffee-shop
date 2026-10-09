// lib/mcp/tools/stats.ts
//
// Outils MCP — statistiques (lecture seule).

import { z } from 'zod';
import {
  getDailyStats,
  getRangeStats,
  getDailySeries,
  getTopProducts,
} from '@/lib/stats';
import { getProductStats } from '@/lib/product-stats';
import { compareRanges } from '@/lib/stats-compare';
import {
  getHourlyDistribution,
  getKitchenPerformance,
} from '@/lib/stats-operations';
import { getCustomerRangeStats } from '@/lib/stats-customers';
import { rangeSchema, toRange } from './helpers';
import type { McpTool } from './types';

export const statsTools: McpTool[] = [
  // — Statistiques (lecture seule) —
  {
    name: 'get_daily_stats',
    toolset: 'stats',
    scope: 'finance',
    title: 'Stats du jour',
    description:
      'Renvoie les statistiques agrégées de la journée en cours (jour civil ' +
      'Abidjan) : nombre de commandes, revenu encaissé, commandes actives/' +
      'terminées/annulées, répartition par type et par mode de paiement.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getDailyStats(),
  },
  {
    name: 'get_range_stats',
    toolset: 'stats',
    scope: 'finance',
    title: 'Stats sur une période',
    description:
      'KPIs agrégés sur une plage de dates (incluse) : commandes, revenu ' +
      'encaissé (CA), panier moyen, taux d’annulation, et répartitions par ' +
      'statut, type de commande et mode de paiement. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getRangeStats(from, to);
    },
  },
  {
    name: 'get_daily_series',
    toolset: 'stats',
    scope: 'finance',
    title: 'Série journalière',
    description:
      'Renvoie, jour par jour sur la plage demandée (jours sans activité ' +
      'inclus à 0), le nombre de commandes et le CA encaissé. Idéal pour ' +
      'tracer une tendance.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getDailySeries(from, to);
    },
  },
  {
    name: 'get_top_products',
    toolset: 'stats',
    scope: 'finance',
    title: 'Top produits',
    description:
      'Renvoie les produits les plus vendus sur la plage (hors commandes ' +
      'annulées), triés par quantité, avec le chiffre d’affaires associé ' +
      '(net de remise). `limit` est optionnel (défaut 8).',
    inputSchema: rangeSchema.extend({
      limit: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Nombre de produits à renvoyer (défaut 8, max 50).'),
    }),
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      const { limit } = args as { limit?: number };
      return getTopProducts(from, to, limit);
    },
  },
  {
    name: 'get_product_stats',
    toolset: 'stats',
    scope: 'finance',
    title: 'Statistiques d’un produit',
    description:
      'Détaille les ventes d’UN produit sur la plage (hors commandes ' +
      'annulées, encaissées ou non) : unités vendues, commandes, chiffre ' +
      'd’affaires net de remise, coût de revient figé sur les lignes de ' +
      'commande et marge, part du CA, rang par quantité, série jour par ' +
      'jour et suppléments les plus choisis. `productId` s’obtient via ' +
      '`get_menu`.',
    inputSchema: rangeSchema.extend({
      productId: z.string().min(1).describe('Identifiant du produit.'),
    }),
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      const { productId } = args as { productId: string };
      return getProductStats(productId, from, to);
    },
  },
  {
    name: 'get_stats_comparison',
    toolset: 'stats',
    scope: 'finance',
    title: 'Comparaison de période',
    description:
      'Compare les KPIs de la plage demandée à la période précédente de même ' +
      'durée (se terminant la veille de `from`) : CA encaissé (régularisations ' +
      'incluses des deux côtés), commandes, panier moyen, dépenses, marge ' +
      'nette, et taux d’annulation (écart en points). Chaque delta expose ' +
      '`pct` (évolution relative, null si la période précédente est vide). ' +
      'Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return compareRanges(from, to);
    },
  },
  {
    name: 'get_hourly_stats',
    toolset: 'stats',
    scope: 'finance',
    title: 'Heures de pointe',
    description:
      'Répartition des commandes et du CA encaissé par heure de la journée ' +
      '(24 points, 0–23, heure d’Abidjan), cumulée sur la plage demandée. ' +
      'Hors commandes annulées ; les régularisations de recette (sans heure) ' +
      'sont exclues du CA horaire. Montants en francs CFA.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getHourlyDistribution(from, to);
    },
  },
  {
    name: 'get_kitchen_performance',
    toolset: 'stats',
    title: 'Performance cuisine',
    description:
      'Temps de préparation (passage en préparation → prêt) et d’attente ' +
      'avant prise en charge, sur la plage demandée (hors commandes ' +
      'annulées) : moyenne et médiane en secondes (null = aucune commande ' +
      'mesurable), nombre de commandes mesurées, et tendance jour par jour.',
    inputSchema: rangeSchema,
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      return getKitchenPerformance(from, to);
    },
  },
  {
    name: 'get_customer_stats',
    toolset: 'stats',
    title: 'Stats clients & fidélité',
    description:
      'Agrégats clients sur la plage demandée : nouveaux clients, clients ' +
      'actifs et récurrents (≥ 2 commandes), taux d’identification des ' +
      'commandes, top clients par CA (somme des commandes non annulées, ' +
      'francs CFA), et mouvements de fidélité (tampons gagnés, récompenses ' +
      'débloquées/utilisées, ajustements signés). `topLimit` est optionnel ' +
      '(défaut 5).',
    inputSchema: rangeSchema.extend({
      topLimit: z
        .number()
        .int()
        .positive()
        .max(20)
        .optional()
        .describe('Nombre de top clients à renvoyer (défaut 5, max 20).'),
    }),
    readOnly: true,
    handler: (args) => {
      const { from, to } = toRange(args);
      const { topLimit } = args as { topLimit?: number };
      return getCustomerRangeStats(from, to, topLimit);
    },
  },
];
