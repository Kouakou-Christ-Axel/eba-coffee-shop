'use client';

import { useState, useTransition } from 'react';
import { Hash, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backfillExpenseReceiptsAction } from './actions';

/**
 * Bandeau affiché quand des dépenses n'ont pas encore de numéro de reçu
 * (typiquement les dépenses créées avant l'ajout de la fonctionnalité). Un clic
 * les numérote rétroactivement (action admin, idempotente) — pas de CLI ni SQL.
 */
export function ReceiptBackfillAlert({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rien à numéroter et rien à confirmer → on n'affiche pas le bandeau.
  if (count === 0 && done === null) return null;

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await backfillExpenseReceiptsAction();
      if (res.ok) setDone(res.updated);
      else setError(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
      {done !== null ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Check className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            {done > 0
              ? `${done} dépense(s) numérotée(s). Les nouvelles dépenses sont numérotées automatiquement.`
              : 'Toutes les dépenses étaient déjà numérotées.'}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Hash className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {count} dépense(s) sans numéro de reçu (créée(s) avant l’activation
            de la numérotation).
          </span>
          <Button size="sm" className="h-7" onClick={run} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Hash className="mr-1.5 h-4 w-4" />
            )}
            Numéroter rétroactivement
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}
