import Link from 'next/link';
import { PackagePlus, PlusCircle } from 'lucide-react';
import { listInventoryItems } from '@/lib/inventory';
import { Card } from '@/components/ui/card';

export async function RestockSection() {
  const items = await listInventoryItems();
  const lowStock = items.filter((i) => i.isLowStock).length;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <PackagePlus className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Enregistrer une réception</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {lowStock > 0
              ? `${lowStock} référence${lowStock > 1 ? 's' : ''} sous le seuil — ajoutables en un appui.`
              : 'Aucune référence sous le seuil actuellement.'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {lowStock > 0 && (
          <Link
            href="/dashboard/inventaire/reappro?prefill=bas"
            className="inline-flex h-11 items-center justify-center rounded-md border px-4 font-medium transition-colors hover:bg-muted"
          >
            Les {lowStock} sous le seuil
          </Link>
        )}
        <Link
          href="/dashboard/inventaire/reappro"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusCircle className="size-4" />
          Nouveau réappro
        </Link>
      </div>
    </Card>
  );
}
