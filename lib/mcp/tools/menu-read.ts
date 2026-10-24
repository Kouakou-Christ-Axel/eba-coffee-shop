// lib/mcp/tools/menu-read.ts
//
// Outils MCP — menu — lecture (`get_menu`).

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
import { buildMenuView } from '@/lib/mcp/menu-view';
import { searchProducts } from '@/lib/menu/search-products';
import { searchProductHits } from '@/lib/menu/product-search';
import { idSchema } from './helpers';
import type { McpTool } from './types';

const getMenuSchema = z.object({
  search: z
    .string()
    .optional()
    .describe('Filtre flou sur le nom du produit ou de la catégorie.'),
  categoryId: idSchema.optional().describe('Limite à une catégorie.'),
  productId: idSchema
    .optional()
    .describe('Détail COMPLET d’un seul produit (suppléments, ids d’options).'),
  detail: z
    .enum(['compact', 'full'])
    .optional()
    .describe('`compact` (défaut) : id, nom, prix, stock. `full` : tout.'),
});

export const menuReadTools: McpTool[] = [
  // — Lecture —
  {
    name: 'get_menu',
    toolset: 'menu',
    title: 'Lire le menu',
    description:
      'Menu avec les `id` à utiliser dans les outils de modification (catégories ' +
      'et produits masqués inclus). Par défaut COMPACT (id, nom, prix, ' +
      'disponibilité, stock). Pour les ids d’options/suppléments, planning ou ' +
      'coûts : `productId` (un produit) ou `detail: "full"` (lourd).',
    inputSchema: getMenuSchema,
    readOnly: true,
    handler: async (args) => {
      const { search, ...options } = args as z.infer<typeof getMenuSchema>;
      return buildMenuView(await getMenuAdmin(), {
        ...options,
        searchHits: search?.trim()
          ? await searchProductHits(search)
          : undefined,
      });
    },
  },
  {
    name: 'search_products',
    toolset: 'menu',
    title: 'Chercher un produit',
    description:
      'Recherche des produits par nom (tolère accents, fautes de frappe et ' +
      'ordre des mots) et renvoie des lignes COMPACTES : `id`, nom, catégorie, ' +
      'prix, `available` (false = masqué), `pausedUntil`, stock. Préférer à ' +
      '`get_menu`, très volumineux, pour retrouver l’`id` d’un produit avant ' +
      'de le modifier. `query` et `categoryId` sont optionnels (max 25 ' +
      'résultats ; `total` donne le nombre de correspondances).',
    inputSchema: z.object({
      query: z.string().max(100).optional().describe('Nom (ou partie du nom).'),
      categoryId: idSchema.optional().describe('Limite à une catégorie.'),
    }),
    readOnly: true,
    handler: async (args) => {
      const { query, categoryId } = args as {
        query?: string;
        categoryId?: string;
      };
      return searchProducts(await getMenuAdmin(), {
        categoryId,
        hits: query?.trim() ? await searchProductHits(query) : undefined,
      });
    },
  },
];
