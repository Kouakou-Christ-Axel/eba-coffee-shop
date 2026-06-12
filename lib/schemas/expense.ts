// lib/schemas/expense.ts
//
// Schémas Zod centralisés pour le suivi des dépenses (catégories + dépenses).
// Réutilisés par les server actions du dashboard, les routes et le serveur MCP.
// Conformément à CLAUDE.md : pas de redéclaration inline ailleurs.

import { z } from 'zod';
import {
  EXPENSE_CATEGORY_NAME_MAX,
  EXPENSE_SUPPLIER_MAX,
  EXPENSE_NOTE_MAX,
  EXPENSE_AMOUNT_MAX,
  EXPENSE_RECURRING_LABEL_MAX,
} from '@/config/constants';
import { imageUrlSchema } from '@/lib/schemas/upload';

// ─── Catégories de dépense ────────────────────────────────────────────────────

export const expenseCategoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(EXPENSE_CATEGORY_NAME_MAX, 'Nom trop long'),
});

export const expenseCategoryUpdateSchema = expenseCategoryInputSchema;

export type ExpenseCategoryInput = z.infer<typeof expenseCategoryInputSchema>;

// ─── Dépenses ─────────────────────────────────────────────────────────────────

export const expensePaymentMethodSchema = z.enum([
  'CASH',
  'WAVE',
  'BANK',
  'OTHER',
]);

export type ExpensePaymentMethodInput = z.infer<
  typeof expensePaymentMethodSchema
>;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

export const expenseInputSchema = z.object({
  date: dateOnly,
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .positive('Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé'),
  categoryId: z.string().min(1, 'Catégorie requise'),
  // Optionnel (pas de `.default` ici : un défaut casserait la règle
  // « au moins un champ » de `expenseUpdateSchema`). Défaut CASH appliqué à
  // la création dans `createExpense`.
  paymentMethod: expensePaymentMethodSchema.optional(),
  supplier: z
    .string()
    .trim()
    .max(EXPENSE_SUPPLIER_MAX, 'Fournisseur trop long')
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(EXPENSE_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
  receiptUrl: imageUrlSchema.nullable().optional(),
});

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

// Mise à jour partielle : tous les champs deviennent optionnels.
export const expenseUpdateSchema = expenseInputSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

// Filtres de liste (plage de jours civils + catégorie + paiement + recherche).
export const expenseFiltersSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  categoryId: z.string().min(1).optional(),
  paymentMethod: expensePaymentMethodSchema.optional(),
  search: z.string().trim().min(1).optional(),
});

export type ExpenseFiltersInput = z.infer<typeof expenseFiltersSchema>;

// ─── Dépenses récurrentes (modèles / aide-mémoire) ─────────────────────────────

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
