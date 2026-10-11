'use client';

// Saisie d'un réapprovisionnement : un combobox unique en tête (tout au focus, manquant d'abord, tolérant aux
// fautes, focus conservé), « Ajouter les N sous le seuil », et un coût unitaire proposé depuis le dernier prix payé
// — jamais prérempli avec le PMP, dont un 0 passerait la validation et l'empoisonnerait.

import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, PackagePlus } from 'lucide-react';
import type { InventoryItemView } from '@/lib/inventory';
import { InventoryItemCombobox } from '../_components/inventory-item-combobox';
import { BatchSettings } from './_components/batch-settings';
import { RestockFooter } from './_components/restock-footer';
import { RestockLineCard } from './_components/restock-line-card';
import type { LastCost } from './_components/restock-shared';
import { useRestockForm } from './_components/use-restock-form';

export type { LastCost };

export function RestockView({
  items,
  expenseCategories,
  lastCosts,
  prefillLowStock,
}: {
  items: InventoryItemView[];
  expenseCategories: { id: string; name: string }[];
  lastCosts: Record<string, LastCost>;
  prefillLowStock: boolean;
}) {
  const form = useRestockForm({ items, lastCosts, prefillLowStock });
  const {
    options,
    usedItemIds,
    addItem,
    addAllLowStock,
    lowStockItems,
    error,
    lines,
  } = form;

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune référence d&apos;inventaire. Créez d&apos;abord des articles
          pour enregistrer un réappro.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <BatchSettings form={form} expenseCategories={expenseCategories} />

      <div className="space-y-2">
        <InventoryItemCombobox
          items={options}
          onPick={addItem}
          usedItemIds={usedItemIds}
        />

        {lowStockItems.length > 0 && (
          <button
            type="button"
            onClick={addAllLowStock}
            className="inline-flex h-11 items-center gap-2 rounded-md border px-3.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <PackagePlus className="size-4" />
            Ajouter les {lowStockItems.length} sous le seuil
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Cherchez une référence ci-dessus pour commencer le réappro.
        </p>
      ) : (
        <div className="space-y-2">
          {lines.map((line, i) => (
            <RestockLineCard
              key={line.itemId}
              form={form}
              line={line}
              index={i}
            />
          ))}
        </div>
      )}

      <RestockFooter form={form} />
    </div>
  );
}
