'use client';

// Ce qu'il faut racheter.
//
// C'était un mur de badges : ni tri, ni action, ni lien. Savoir que cinq
// références sont basses ne sert à rien si la suite — ouvrir le réappro et
// retrouver ces cinq-là une par une — coûte autant que si on ne l'avait pas su.
//
// Deux corrections : l'ordre est celui de l'urgence RELATIVE (il manque plus
// gravement 2 gobelets sur un seuil de 4 que 8 tasses sur un seuil de 100), et
// la carte mène au réappro déjà pré-rempli.

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import type { InventoryItemView } from '@/lib/inventory';
import { thresholdOf, urgencyRatio } from '@/lib/inventory-item-search';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 });
const CAP = 8;

export function LowStockAlert({
  items,
  canRestock,
}: {
  items: InventoryItemView[];
  canRestock: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const sorted = [...items].sort(
    (a, b) =>
      urgencyRatio(toOption(a)) - urgencyRatio(toOption(b)) ||
      a.name.localeCompare(b.name, 'fr')
  );
  const shown = expanded ? sorted : sorted.slice(0, CAP);
  const rest = sorted.length - shown.length;

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-5" />
          Stock bas ({items.length})
        </CardTitle>
        {canRestock && (
          <Link
            href="/dashboard/inventaire/reappro?prefill=bas"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-amber-400 px-3.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            Réapprovisionner
            <ArrowRight className="size-4" />
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-amber-200 dark:divide-amber-900/50">
          {shown.map((item) => {
            const threshold = thresholdOf(item);
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-amber-900 dark:text-amber-200">
                  {item.name}
                </span>
                <span className="shrink-0 text-amber-800/80 tabular-nums dark:text-amber-300/80">
                  {f.format(item.currentQuantity)} / {f.format(threshold)}{' '}
                  {item.unit}
                </span>
              </li>
            );
          })}
        </ul>
        {rest > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-2 h-11 text-sm font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
          >
            Voir les {rest} autres
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function toOption(item: InventoryItemView) {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    currentQuantity: item.currentQuantity,
    safetyStock: item.safetyStock,
    reorderPoint: item.reorderPoint,
    isLowStock: item.isLowStock,
  };
}
