// lib/mcp/tools/menu-read.ts
//
// Outils MCP — menu — lecture (`get_menu`).

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
import { searchProducts } from '@/lib/menu/search-products';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const menuReadTools: McpTool[] = [
  // — Lecture —
  {
    name: 'get_menu',
    toolset: 'menu',
    title: 'Lire le menu',
    description:
      'Renvoie le menu complet avec les identifiants internes (id), y compris ' +
      'les catégories et produits masqués. Utilise les `id` renvoyés ici pour ' +
      'cibler les outils de modification.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => getMenuAdmin(),
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
    handler: async (args) =>
      searchProducts(
        await getMenuAdmin(),
        args as { query?: string; categoryId?: string }
      ),
  },
];
