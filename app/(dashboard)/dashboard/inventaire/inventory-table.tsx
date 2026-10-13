'use client';

import type { InventoryItemView } from '@/lib/inventory';
import { InventoryRows } from './_components/table/inventory-rows';
import { InventoryToolbar } from './_components/table/inventory-toolbar';
import { ItemSheets } from './_components/table/item-sheets';
import { useInventoryTable } from './_components/table/use-inventory-table';

export function InventoryTable({
  items,
  archived,
  categories,
}: {
  items: InventoryItemView[];
  archived: InventoryItemView[];
  categories: string[];
}) {
  const table = useInventoryTable({ items, archived });

  return (
    <div className="space-y-3">
      <InventoryToolbar
        table={table}
        categories={categories}
        archivedCount={archived.length}
      />

      {table.listError && (
        <p className="text-sm text-destructive" role="alert">
          {table.listError}
        </p>
      )}

      <InventoryRows table={table} />

      <ItemSheets table={table} categories={categories} />

      {table.confirmDialog}
    </div>
  );
}
