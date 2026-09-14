'use client';

// Point d'entrée du comptage, à la place de l'ancienne grille.
//
// La grille de 117 lignes n'a rien à faire dans un onglet : elle vit maintenant
// sur sa propre route. Reste ici ce qu'on veut savoir sans y entrer — depuis
// quand le stock n'a pas été compté, et s'il y a un comptage en cours à
// reprendre.

import Link from 'next/link';
import { ClipboardList, PlayCircle, RotateCcw } from 'lucide-react';

import { countEntered } from '@/lib/inventory-count-draft';
import {
  useInventoryCountHydration,
  useInventoryCountStore,
} from '@/lib/hooks/use-inventory-count';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const dateFmt = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
});

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dateFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

export function CountLauncher({
  total,
  daysSince,
}: {
  total: number;
  daysSince: number | null;
}) {
  const hasHydrated = useInventoryCountHydration();
  const draft = useInventoryCountStore((s) => s.draft);

  // Tant que le brouillon n'est pas relu depuis localStorage, on n'affirme rien
  // — sinon le serveur rend « Commencer » et le client « Reprendre », et React
  // lève un désaccord d'hydratation.
  if (!hasHydrated) {
    return <Skeleton className="h-28 rounded-xl" />;
  }

  const entered = draft ? countEntered(draft.counts) : 0;
  const resuming = draft !== null && entered > 0;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">
            {resuming
              ? `Comptage en cours — ${entered} / ${total}`
              : `${total} références à compter`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {resuming
              ? `Commencé le ${formatDay(draft.date)}, conservé sur cet appareil.`
              : daysSince === null
                ? 'Aucun comptage enregistré pour le moment.'
                : `Dernier comptage il y a ${daysSince} jour${daysSince > 1 ? 's' : ''}.`}
          </p>
        </div>
      </div>

      <Link
        href="/dashboard/inventaire/comptage"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        {resuming ? (
          <>
            <RotateCcw className="size-4" />
            Reprendre
          </>
        ) : (
          <>
            <PlayCircle className="size-4" />
            Compter le stock
          </>
        )}
      </Link>
    </Card>
  );
}
