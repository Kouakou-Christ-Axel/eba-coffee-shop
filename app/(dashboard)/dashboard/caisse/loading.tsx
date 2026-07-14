import { Skeleton } from '@/components/ui/skeleton';

// Écran caisse (POS) : file d'attente + grille produits + panier. Skeleton
// générique (grille de cartes + colonne panier) — le contenu réel est très
// dynamique (temps réel), l'isomorphisme exact n'a pas de sens ici.
export default function CaisseLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-32" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
