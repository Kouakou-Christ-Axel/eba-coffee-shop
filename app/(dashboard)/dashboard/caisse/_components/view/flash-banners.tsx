'use client';

import { CheckCircle2, PackageCheck, X } from 'lucide-react';

export function CreatedFlashBanner({
  createdFlash,
  onClose,
}: {
  createdFlash: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-primary shadow-sm">
      <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-bold">
        Commande #{createdFlash.padStart(3, '0')} créée
      </p>
      <button
        type="button"
        onClick={() => onClose()}
        aria-label="Fermer"
        className="shrink-0 rounded-full p-1 transition-colors hover:bg-primary/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ReadyFlashBanner({
  readyFlash,
  onClose,
}: {
  readyFlash: number[];
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-green-300 bg-green-50 px-4 py-3 text-green-900 shadow-sm dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
      <PackageCheck className="h-6 w-6 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">
          {readyFlash.length > 1
            ? `${readyFlash.length} commandes prêtes !`
            : 'Commande prête !'}
        </p>
        <p className="truncate text-xs">
          {readyFlash.map((n) => `#${String(n).padStart(3, '0')}`).join(', ')} —
          à remettre au client
        </p>
      </div>
      <button
        type="button"
        onClick={() => onClose()}
        aria-label="Fermer"
        className="shrink-0 rounded-full p-1 text-green-700 transition-colors hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/40"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
