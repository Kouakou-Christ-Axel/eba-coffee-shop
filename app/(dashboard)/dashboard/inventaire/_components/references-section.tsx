import { listInventoryItems, listInventoryCategories } from '@/lib/inventory';
import { InventoryTable } from '../inventory-table';

export async function ReferencesSection() {
  const [items, categories] = await Promise.all([
    listInventoryItems(),
    listInventoryCategories(),
  ]);
  return <InventoryTable items={items} categories={categories} />;
}
