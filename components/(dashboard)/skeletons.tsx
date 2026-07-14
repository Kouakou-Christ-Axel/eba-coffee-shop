// components/(dashboard)/skeletons.tsx
//
// Blocs de skeleton réutilisables pour les `loading.tsx` du dashboard (et les
// fallbacks `<Suspense>` des sections streamées — Phase 2). Composés à partir
// de `@/components/ui/skeleton` (shadcn), pas HeroUI — déviation volontaire
// vs CLAUDE.md pour rester cohérent avec les 2 `loading.tsx` déjà en place
// (statistiques, commandes), qui utilisent ce pattern.
//
// Isomorphes par construction : hauteurs/grilles calées sur les composants
// réels (`KpiCard`, `Card` + chart, `Table`, formulaires en `Card`).

import { Skeleton } from '@/components/ui/skeleton';

/** En-tête de page : titre + sous-titre, avec actions optionnelles à droite. */
export function PageHeaderSkeleton({
  actions = 0,
  withSubtitle = true,
}: {
  /** Nombre de boutons d'action affichés à droite du titre. */
  actions?: number;
  withSubtitle?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        {withSubtitle && <Skeleton className="h-4 w-64" />}
      </div>
      {actions > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      )}
    </div>
  );
}

/** Grille de `KpiCard` (hauteur ~ h-28, cf. `components/(dashboard)/kpi-card.tsx`). */
export function KpiGridSkeleton({
  count = 4,
  cols = 4,
}: {
  count?: number;
  cols?: 2 | 3 | 4;
}) {
  const colsClass =
    cols === 2
      ? 'sm:grid-cols-2'
      : cols === 3
        ? 'lg:grid-cols-3'
        : 'sm:grid-cols-4';
  return (
    <div className={`grid grid-cols-2 gap-3 ${colsClass}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/** `Card` contenant un chart (titre + zone graphique de hauteur fixe). */
export function ChartCardSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="space-y-3 rounded-xl border p-4 sm:p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="rounded-lg" style={{ height }} />
    </div>
  );
}

/** `Card` avec table : en-tête (titre + filtres) + N lignes. */
export function TableSkeleton({
  rows = 8,
  withHeader = true,
  withToolbar = true,
}: {
  rows?: number;
  withHeader?: boolean;
  withToolbar?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border p-4 sm:p-6">
      {withHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-5 w-40" />
          {withToolbar && (
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-[160px]" />
              <Skeleton className="h-9 w-28" />
            </div>
          )}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/** `Card` formulaire : N champs empilés + bouton de soumission. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 rounded-xl border p-4 sm:p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-32" />
    </div>
  );
}
