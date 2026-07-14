import { listInventoryItems } from '@/lib/inventory';
import { LowStockAlert } from '../low-stock-alert';

// `listInventoryItems()` est dédupliqué (`cache()`, lib/inventory.ts) avec
// les sections des onglets Références/Comptage/Réappro qui en ont aussi
// besoin — un seul SELECT malgré les 4 usages.
export async function LowStockSection() {
  const items = await listInventoryItems();
  return <LowStockAlert items={items.filter((i) => i.isLowStock)} />;
}
