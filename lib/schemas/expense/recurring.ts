import { z } from 'zod';
import {
  EXPENSE_AMOUNT_MAX,
  EXPENSE_RECURRING_LABEL_MAX,
} from '@/config/constants';

export const recurringExpenseInputSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(EXPENSE_RECURRING_LABEL_MAX, 'Libellé trop long'),
  categoryId: z.string().min(1, 'Catégorie requise'),
  expectedAmount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
    .nullable()
    .optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  active: z.boolean().optional(),
});

export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>;

export const recurringExpenseUpdateSchema = recurringExpenseInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type RecurringExpenseUpdateInput = z.infer<
  typeof recurringExpenseUpdateSchema
>;
