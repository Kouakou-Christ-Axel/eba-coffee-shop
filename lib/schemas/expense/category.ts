import { z } from 'zod';
import { EXPENSE_CATEGORY_NAME_MAX } from '@/config/constants';

// FIXED = charge fixe (loyer, salaires, abonnements…), VARIABLE = achat
// courant. Porté par la catégorie (cf. prisma `ExpenseNature`), défaut VARIABLE.
export const expenseNatureSchema = z.enum(['FIXED', 'VARIABLE']);

export type ExpenseNatureInput = z.infer<typeof expenseNatureSchema>;

export const expenseCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(EXPENSE_CATEGORY_NAME_MAX, 'Nom trop long'),
  // Optionnelle : défaut VARIABLE côté DB.
  nature: expenseNatureSchema.optional(),
});

export const expenseCategoryUpdateSchema = expenseCategoryInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>;

export type ExpenseCategoryUpdateInput = z.infer<
  typeof expenseCategoryUpdateSchema
>;
