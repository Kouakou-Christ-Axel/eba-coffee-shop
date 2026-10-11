'use client';

import { f } from './restock-shared';
import type { RestockForm } from './use-restock-form';

export function RestockFooter({ form }: { form: RestockForm }) {
  const {
    pending,
    lines,
    grandTotal,
    unknownCostCount,
    missingCategory,
    canSubmit,
    handleSubmit,
  } = form;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur">
      {unknownCostCount > 0 && lines.length > 0 && (
        <p className="mb-2 text-center text-xs text-muted-foreground">
          Coût inconnu sur {unknownCostCount} ligne
          {unknownCostCount > 1 ? 's' : ''} — le réappro reste enregistrable.
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <span>
          {pending ? 'Enregistrement…' : 'Valider le réappro'}
          {lines.length > 0 && ` · ${lines.length}`}
        </span>
        <span className="tabular-nums">
          {f.format(Math.round(grandTotal))} F
        </span>
      </button>
      {missingCategory && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Choisissez une catégorie de dépense.
        </p>
      )}
    </div>
  );
}
