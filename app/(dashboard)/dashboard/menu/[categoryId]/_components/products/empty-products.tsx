'use client';

import Link from 'next/link';
import { PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Catégorie sans aucun produit : rien à dévoiler, quelque chose à créer (≠ « aucun résultat » des filtres). */
export function EmptyProducts({ categoryId }: { categoryId: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <div className="rounded-full bg-muted p-3">
        <PackagePlus className="size-6 text-muted-foreground" />
      </div>
      <h2 className="font-semibold">Aucun produit dans cette catégorie</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Un produit, c’est ce que le client commande : un nom, une description et
        un prix suffisent pour commencer. Le reste — photo, coûts, suppléments —
        se complète quand vous voulez.
      </p>
      <Button asChild className="mt-1">
        <Link href={`/dashboard/menu/${categoryId}/produits/new`}>
          <PackagePlus className="size-4" />
          Créer le premier produit
        </Link>
      </Button>
    </div>
  );
}
