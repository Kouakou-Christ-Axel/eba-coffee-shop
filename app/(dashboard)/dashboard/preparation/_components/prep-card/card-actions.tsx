'use client';

import { Check, CheckCheck, ChefHat, X } from 'lucide-react';

export function CardActions({
  orderId,
  pending,
  onReady,
  onCancel,
  onRetrieve,
}: {
  orderId: string;
  pending: boolean;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRetrieve: (id: string) => void;
}) {
  return (
    <>
      {/* Actions */}
      <div className="grid grid-cols-[1fr_2.5fr] gap-2 border-t p-2">
        <button
          type="button"
          onClick={() => onCancel(orderId)}
          disabled={pending}
          aria-label="Annuler"
          className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 py-2.5 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => onReady(orderId)}
          disabled={pending}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
        >
          {pending ? (
            <ChefHat className="h-5 w-5 animate-pulse" />
          ) : (
            <Check className="h-5 w-5" strokeWidth={3} />
          )}
          Prête
        </button>
      </div>

      {/* Récupération anticipée : discrète, pour ne pas concurrencer « Prête »
          — le client peut repartir avant la fin de la préparation affichée. */}
      <button
        type="button"
        onClick={() => onRetrieve(orderId)}
        disabled={pending}
        className="flex items-center justify-center gap-1 border-t py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
      >
        <CheckCheck className="h-3 w-3" strokeWidth={2.5} />
        Marquer récupérée
      </button>
    </>
  );
}
