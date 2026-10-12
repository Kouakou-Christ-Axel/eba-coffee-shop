'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EXPENSE_ITEMS_MAX } from '@/config/constants';
import { ArticleCombobox } from '../article-combobox';
import { ExpenseItemRow } from '../expense-item-row';
import type { ExpenseFormState } from './use-expense-form';
import type { ArticleOption } from './types';

export function ExpenseItemsSection({
  form,
  articles,
}: {
  form: ExpenseFormState;
  articles: ArticleOption[];
}) {
  const {
    values,
    detailed,
    usedArticleIds,
    atItemsLimit,
    lastAddedIndex,
    addFromPick,
    setItem,
    replaceArticle,
    removeItem,
    clearItems,
  } = form;
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Articles</p>
        {detailed && (
          <Button type="button" variant="ghost" size="sm" onClick={clearItems}>
            <X className="mr-1 h-4 w-4" />
            Saisir un montant global sans détail
          </Button>
        )}
      </div>

      {articles.length === 0 && !detailed ? (
        <p className="text-sm text-muted-foreground">
          Aucun article enregistré pour l’instant — tape un nom pour créer le
          premier.
        </p>
      ) : null}

      <ArticleCombobox
        articles={articles}
        onPick={addFromPick}
        usedArticleIds={usedArticleIds}
      />

      {atItemsLimit && (
        <p className="text-xs text-muted-foreground">
          Limite de {EXPENSE_ITEMS_MAX} lignes atteinte.
        </p>
      )}

      {detailed && (
        <div className="space-y-3">
          {values.items.map((item, i) => (
            <ExpenseItemRow
              key={i}
              item={item}
              index={i}
              articles={articles}
              usedArticleIds={usedArticleIds}
              autoFocusQuantity={i === lastAddedIndex}
              onPatch={(patch) => setItem(i, patch)}
              onReplaceArticle={(pick) => replaceArticle(i, pick)}
              onRemove={() => removeItem(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
