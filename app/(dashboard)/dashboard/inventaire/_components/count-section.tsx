import { listInventoryItems } from '@/lib/inventory';
import { InventoryCountGrid } from '../inventory-count-grid';

export async function CountSection() {
  const items = await listInventoryItems();
  return <InventoryCountGrid items={items} />;
}
