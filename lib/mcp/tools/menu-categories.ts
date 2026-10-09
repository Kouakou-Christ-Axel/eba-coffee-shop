// lib/mcp/tools/menu-categories.ts
//
// Outils MCP — menu — catégories.

import { z } from 'zod';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/menu-mutations';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const menuCategoriesTools: McpTool[] = [
  // — Catégories —
  {
    name: 'create_category',
    toolset: 'menu',
    title: 'Créer une catégorie',
    description:
      'Crée une nouvelle catégorie de menu. Le slug et l’ordre sont générés ' +
      'automatiquement. `scheduleId` (optionnel) assigne un planning récurrent ' +
      '(voir `list_product_schedules`) : la catégorie et ses produits ne sont ' +
      'alors commandables que les jours du planning — absent = tous les jours.',
    inputSchema: createCategorySchema,
    readOnly: false,
    handler: (args) =>
      createCategory(args as z.infer<typeof createCategorySchema>),
  },
  {
    name: 'update_category',
    toolset: 'menu',
    title: 'Renommer une catégorie',
    description:
      'Met à jour une catégorie existante de façon PARTIELLE : ne fournis que ' +
      'les champs à modifier. `scheduleId: null` retire le planning récurrent ' +
      'assigné (catégorie de nouveau disponible tous les jours).',
    inputSchema: updateCategorySchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string } & z.infer<
        typeof updateCategorySchema
      >;
      return updateCategory(id, rest);
    },
  },
  {
    name: 'delete_category',
    toolset: 'menu',
    title: 'Supprimer une catégorie',
    description:
      'Supprime une catégorie et, en cascade, tous ses produits. Soft delete : ' +
      'la catégorie et ses produits sont masqués partout mais conservés en base ' +
      '(et n’apparaissent plus dans `get_menu`). Recréer une catégorie du même ' +
      'nom repart d’une catégorie neuve.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteCategory((args as { id: string }).id),
  },
  {
    name: 'toggle_category_availability',
    toolset: 'menu',
    title: 'Afficher/masquer une catégorie',
    description:
      'Inverse la visibilité d’une catégorie sur le site public (visible ↔ ' +
      'masquée).',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => toggleCategoryAvailability((args as { id: string }).id),
  },
  {
    name: 'move_category',
    toolset: 'menu',
    title: 'Réordonner une catégorie',
    description:
      'Déplace une catégorie d’un cran vers le haut ou vers le bas dans ' +
      'l’ordre d’affichage.',
    inputSchema: z.object({
      id: idSchema,
      direction: z.enum(['up', 'down']),
    }),
    readOnly: false,
    handler: (args) => {
      const { id, direction } = args as {
        id: string;
        direction: 'up' | 'down';
      };
      return moveCategory(id, direction);
    },
  },
];
