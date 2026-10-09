import { z } from 'zod';
import {
  EXPENSE_AMOUNT_MAX,
  EXPENSE_ARTICLE_NAME_MAX,
  EXPENSE_ITEM_LABEL_MAX,
  EXPENSE_ITEM_UNIT_MAX,
  EXPENSE_ITEMS_MAX,
  EXPENSE_ITEM_QUANTITY_MAX,
} from '@/config/constants';

export const expenseItemInputSchema = z.object({
  articleId: z.string().min(1).optional(),
  articleName: z
    .string()
    .trim()
    .min(1)
    .max(EXPENSE_ARTICLE_NAME_MAX, "Nom d'article trop long")
    .optional(),
  rawLabel: z
    .string()
    .trim()
    .min(1, 'Libellé requis')
    .max(EXPENSE_ITEM_LABEL_MAX, 'Libellé trop long'),
  label: z
    .string()
    .trim()
    .max(EXPENSE_ITEM_LABEL_MAX, 'Précision trop longue')
    .nullable()
    .optional(),
  formatQty: z
    .number()
    .positive('Quantité invalide')
    .max(EXPENSE_ITEM_QUANTITY_MAX, 'Quantité trop élevée')
    .nullable()
    .optional(),
  formatSize: z
    .number()
    .positive('Taille de format invalide')
    .max(EXPENSE_ITEM_QUANTITY_MAX, 'Taille de format trop élevée')
    .nullable()
    .optional(),
  unit: z
    .string()
    .trim()
    .max(EXPENSE_ITEM_UNIT_MAX, 'Unité trop longue')
    .nullable()
    .optional(),
  unitPrice: z
    .number()
    .int('Prix unitaire entier (FCFA)')
    .min(0, 'Prix unitaire invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Prix unitaire trop élevé')
    .nullable()
    .optional(),
  amount: z
    .number()
    .int('Montant entier (FCFA)')
    .min(0, 'Montant invalide')
    .max(EXPENSE_AMOUNT_MAX, 'Montant trop élevé')
    .optional(),
  // Montant connu mais quantité pas encore renseignée (à compléter plus tard).
  pendingQuantity: z.boolean().optional(),
});

export type ExpenseItemInput = z.infer<typeof expenseItemInputSchema>;

/** Montant effectif : fourni, sinon `formatQty × (formatSize ?? 1) × unitPrice`. */
export function resolveExpenseItemAmount(item: {
  amount?: number | null;
  formatQty?: number | null;
  formatSize?: number | null;
  unitPrice?: number | null;
}): number | null {
  if (item.amount !== undefined && item.amount !== null) return item.amount;
  if (item.unitPrice == null || item.formatQty == null) return null;
  const size = item.formatSize ?? 1;
  return Math.round(item.formatQty * size * item.unitPrice);
}

export const expenseItemsArraySchema = z
  .array(expenseItemInputSchema)
  .max(EXPENSE_ITEMS_MAX, 'Trop de lignes de détail');
