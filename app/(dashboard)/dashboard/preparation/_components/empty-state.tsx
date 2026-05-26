'use client';

import { Check } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border bg-card py-12 text-center">
      <div className="rounded-full bg-green-100 p-6 dark:bg-green-950">
        <Check className="h-16 w-16 text-green-600 dark:text-green-400" />
      </div>
      <h1 className="text-3xl font-bold">Aucune commande en cuisine</h1>
      <p className="max-w-md text-base text-muted-foreground">
        Les commandes apparaissent ici dès qu&apos;elles sont encaissées par la
        caisse, ou envoyées en cuisine manuellement.
      </p>
    </div>
  );
}
