// lib/mcp/tools/menu-read.ts
//
// Outils MCP — menu — lecture (`get_menu`).

import { z } from 'zod';
import { getMenuAdmin } from '@/lib/menu';
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
];
