'use client';

import Link from 'next/link';
import { CheckCircle2, Plus, X } from 'lucide-react';

/** Bouton « Nouvelle commande », confirmation de création et erreur de lancement. */
export function PreparationBanners({
  createdFlash,
  onDismissFlash,
  launchError,
}: {
  createdFlash: string | null;
  onDismissFlash: () => void;
  launchError: string | null;
}) {
  return (
    <>
      <div className="mt-3 flex justify-end">
        <Link
          href="/dashboard/preparation/new"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nouvelle commande
        </Link>
      </div>

      {createdFlash && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-primary shadow-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm font-bold">
            Commande #{createdFlash.padStart(3, '0')} créée
          </p>
          <button
            type="button"
            onClick={onDismissFlash}
            aria-label="Fermer"
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-primary/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {launchError && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800"
        >
          {launchError}
        </p>
      )}
    </>
  );
}
