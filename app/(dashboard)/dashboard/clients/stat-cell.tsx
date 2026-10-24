'use client';

// Cellule de stats d'un client. Les stats arrivent en streaming (promesse créée
// côté serveur en même temps que les fiches, cf.
// `listCustomersWithDeferredStats`) : `use()` suspend UNIQUEMENT cette cellule,
// qui montre un squelette ; le reste de la ligne est déjà affiché.

import { Suspense, use, type ReactNode } from 'react';
import type { CustomerStats } from '@/lib/customers';

/** Stats par id ; `null` si le calcul a échoué côté serveur. */
export type StatsById = Record<string, CustomerStats> | null;

function Resolved({
  stats,
  id,
  children,
}: {
  stats: Promise<StatsById>;
  id: string;
  children: (stats: CustomerStats) => ReactNode;
}) {
  const byId = use(stats);
  const mine = byId?.[id];
  return mine ? (
    children(mine)
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function StatCell(props: {
  stats: Promise<StatsById>;
  id: string;
  children: (stats: CustomerStats) => ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <span
          className="inline-block h-4 w-12 animate-pulse rounded bg-muted"
          aria-label="Chargement"
        />
      }
    >
      <Resolved {...props} />
    </Suspense>
  );
}
