'use client';

import { ExpenseActionBar } from './_components/expense-form/expense-action-bar';
import { ExpenseFieldsSection } from './_components/expense-form/expense-fields-section';
import { ExpenseItemsSection } from './_components/expense-form/expense-items-section';
import { ReceiptPicker } from './_components/expense-form/receipt-picker';
import type {
  ArticleOption,
  Category,
  ExpenseFormValues,
} from './_components/expense-form/types';
import { useExpenseForm } from './_components/expense-form/use-expense-form';

export type {
  ArticleOption,
  ExpenseFormValues,
  ExpenseItemFormValues,
} from './_components/expense-form/types';

export function ExpenseForm({
  categories,
  articles,
  mode,
  initial,
  cancelHref = '/dashboard/depenses',
}: {
  categories: Category[];
  /** Référentiel pour le choix d'article. */
  articles: ArticleOption[];
  mode: 'create' | 'edit';
  initial: ExpenseFormValues;
  /** Destination du bouton Annuler et du retour après succès. */
  cancelHref?: string;
}) {
  const form = useExpenseForm({ mode, initial, cancelHref });

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Crée d’abord une catégorie pour pouvoir saisir une dépense.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-4 pb-24">
      <ExpenseFieldsSection form={form} categories={categories} />
      <ExpenseItemsSection form={form} articles={articles} />
      <ReceiptPicker form={form} />
      {form.error && <p className="text-sm text-destructive">{form.error}</p>}
      <ExpenseActionBar form={form} />
    </div>
  );
}
