// lib/mcp/tools/expense-categories.ts
//
// Outils MCP — catégories de dépenses.

import { z } from 'zod';
import { listExpenseCategories } from '@/lib/expenses';
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from '@/lib/expense-mutations';
import { expenseCategoryInputSchema } from '@/lib/schemas/expense';
import { idSchema } from './helpers';
import type { McpTool } from './types';

export const expenseCategoriesTools: McpTool[] = [
  // — Dépenses : catégories —
  {
    name: 'list_expense_categories',
    toolset: 'finance',
    scope: 'finance',
    title: 'Lister les catégories de dépense',
    description:
      'Renvoie les catégories de dépense avec leur `id` et le nombre de ' +
      'dépenses rattachées. Utilise ces `id` pour `create_expense`.',
    inputSchema: z.object({}),
    readOnly: true,
    handler: () => listExpenseCategories(),
  },
  {
    name: 'create_expense_category',
    toolset: 'finance',
    scope: 'finance',
    title: 'Créer une catégorie de dépense',
    description:
      'Crée une catégorie de dépense (ex. « Emballages », « Loyer »). Le nom ' +
      'doit être unique.',
    inputSchema: expenseCategoryInputSchema,
    readOnly: false,
    handler: (args) => createExpenseCategory(args),
  },
  {
    name: 'update_expense_category',
    toolset: 'finance',
    scope: 'finance',
    title: 'Renommer une catégorie de dépense',
    description: 'Met à jour le nom d’une catégorie de dépense.',
    inputSchema: expenseCategoryInputSchema.extend({ id: idSchema }),
    readOnly: false,
    handler: (args) => {
      const { id, ...rest } = args as { id: string; name: string };
      return updateExpenseCategory(id, rest);
    },
  },
  {
    name: 'delete_expense_category',
    toolset: 'finance',
    scope: 'finance',
    title: 'Supprimer une catégorie de dépense',
    description:
      'Supprime une catégorie de dépense. Refusé si des dépenses y sont ' +
      'rattachées.',
    inputSchema: z.object({ id: idSchema }),
    readOnly: false,
    handler: (args) => deleteExpenseCategory((args as { id: string }).id),
  },
];
