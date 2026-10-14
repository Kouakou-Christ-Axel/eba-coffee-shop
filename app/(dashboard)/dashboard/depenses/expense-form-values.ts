// Valeurs initiales du formulaire de dépense (vierge ou issues d'une dépense
// enregistrée). Isolées du composant client (`'use client'`) car les pages de
// saisie (création, édition, duplication) les préparent côté serveur.

import { emptyExpenseItemDraft } from '@/lib/expense-item-draft';
import type { ExpenseForEdit } from '@/lib/expenses';
import { formatLocalDateOnly, todayDateString } from '@/lib/timezone';
import type {
  Category,
  ExpenseFormValues,
} from './_components/expense-form/types';

/** Valeurs par défaut d'une nouvelle dépense (formulaire vierge). */
export function emptyExpense(categories: Category[]): ExpenseFormValues {
  return {
    date: todayDateString(),
    amount: '',
    categoryId: categories[0]?.id ?? '',
    paymentMethod: 'CASH',
    supplier: '',
    note: '',
    receiptUrl: null,
    items: [],
  };
}

/**
 * `mode: 'duplicate'` recopie le détail mais repart d'une dépense neuve : pas
 * d'`id`, date du jour, et surtout pas le justificatif de l'originale.
 * Re-saisir le même panier du marché devient ainsi immédiat.
 */
export function expenseToFormValues(
  expense: ExpenseForEdit,
  mode: 'edit' | 'duplicate'
): ExpenseFormValues {
  return {
    id: mode === 'edit' ? expense.id : undefined,
    date:
      mode === 'duplicate'
        ? todayDateString()
        : formatLocalDateOnly(expense.date),
    amount: String(expense.amount),
    categoryId: expense.categoryId,
    paymentMethod: expense.paymentMethod,
    supplier: expense.supplier ?? '',
    note: expense.note ?? '',
    receiptUrl: mode === 'duplicate' ? null : expense.receiptUrl,
    items: expense.items.map((item) => ({
      ...emptyExpenseItemDraft(),
      articleId: item.articleId,
      rawLabel: item.rawLabel,
      label: item.label ?? '',
      formatQty: item.formatQty != null ? String(item.formatQty) : '',
      formatSize: item.formatSize != null ? String(item.formatSize) : '',
      unit: item.unit ?? '',
      unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
      amount: String(item.amount),
      pendingQuantity: item.pendingQuantity,
    })),
  };
}
