// lib/mcp/tools/menu-read.ts
//
// Outils MCP — menu — lecture (`get_menu`).

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
import { buildMenuView } from '@/lib/mcp/menu-view';
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
    handler: async (args) =>
      buildMenuView(
        await getMenuAdmin(),
        args as z.infer<typeof getMenuSchema>
      ),
  },
];
