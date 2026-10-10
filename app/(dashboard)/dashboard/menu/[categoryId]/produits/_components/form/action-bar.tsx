'use client';

import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProductFormState } from './use-product-form';

export function ActionBar({ form }: { form: ProductFormState }) {
  const {
    isEdit,
    isUploading,
    isPending,
    submitError,
    isDirty,
    missing,
    goToField,
    handleCancel,
  } = form;
  return (
    <div className="sticky bottom-0 z-10 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending || isUploading}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending
            ? 'Enregistrement…'
            : isEdit
              ? 'Enregistrer'
              : 'Créer le produit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isPending}
        >
          Annuler
        </Button>
        {isUploading && (
          <span className="text-sm text-muted-foreground">
            Image en cours d&apos;envoi…
          </span>
        )}
        {!isUploading && isDirty && !isPending && (
          <span className="text-sm text-amber-600">
            Modifications non enregistrées
          </span>
        )}
      </div>

      {/* Rappel neutre : il annonce, il ne reproche pas. */}
      {!isPending && missing.length > 0 && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
          <span>
            Il reste {missing.length} champ
            {missing.length > 1 ? 's' : ''} obligatoire
            {missing.length > 1 ? 's' : ''} :
          </span>
          {missing.map((m, i) => (
            <span key={m.field}>
              <button
                type="button"
                onClick={() => goToField(m.field)}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                {m.label}
              </button>
              {i < missing.length - 1 && ','}
            </span>
          ))}
        </p>
      )}
      {!isPending && missing.length === 0 && !isEdit && !submitError && (
        <p className="mt-2 text-sm text-muted-foreground">
          Prêt à créer. Le reste peut se compléter plus tard.
        </p>
      )}

      {submitError && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {submitError}
        </p>
      )}
    </div>
  );
}
