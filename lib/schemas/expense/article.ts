import { z } from 'zod';
import {
  EXPENSE_NOTE_MAX,
  EXPENSE_AMOUNT_MAX,
  EXPENSE_ARTICLE_NAME_MAX,
} from '@/config/constants';
import { BASE_UNITS } from '@/lib/expense-units';

export const expenseArticleRenameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(EXPENSE_ARTICLE_NAME_MAX, 'Nom trop long'),
});

export type ExpenseArticleRenameInput = z.infer<
  typeof expenseArticleRenameSchema
>;

export const expenseArticleSettingsSchema = z
  .object({
    baseUnit: z.enum(BASE_UNITS).nullable().optional(),
    trackInventory: z.boolean().optional(),
    location: z
      .string()
      .trim()
      .max(EXPENSE_NOTE_MAX, 'Emplacement trop long')
      .nullable()
      .optional(),
    wholesaleRefPrice: z
      .number()
      .int('Prix entier (FCFA)')
      .min(0, 'Prix invalide')
      .max(EXPENSE_AMOUNT_MAX, 'Prix trop élevé')
      .nullable()
      .optional(),
    inventoryItemId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseArticleSettingsInput = z.infer<
  typeof expenseArticleSettingsSchema
>;

// Fusion de deux articles (dédoublonnage) : `sourceId` est absorbé par
// `targetId` (jamais l'inverse).
export const articleMergeSchema = z
  .object({
    sourceId: z.string().min(1, 'Article source requis'),
    targetId: z.string().min(1, 'Article cible requis'),
  })
  .refine((v) => v.sourceId !== v.targetId, {
    message: 'Impossible de fusionner un article avec lui-même',
    path: ['targetId'],
  });

export type ArticleMergeInput = z.infer<typeof articleMergeSchema>;

// Re-rattache une ligne de dépense existante à un autre article (correction
// d'un rapprochement erroné) — apprend l'alias correspondant.
export const relinkExpenseItemSchema = z.object({
  itemId: z.string().min(1, 'Ligne requise'),
  articleId: z.string().min(1, 'Article requis'),
});

export type RelinkExpenseItemInput = z.infer<typeof relinkExpenseItemSchema>;
