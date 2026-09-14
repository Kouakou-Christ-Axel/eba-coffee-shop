import { listInventoryItems } from '@/lib/inventory';
import { LowStockAlert } from '../low-stock-alert';

export async function LowStockSection({ canRestock }: { canRestock: boolean }) {
  const items = await listInventoryItems();
  return (
    <LowStockAlert
      items={items.filter((i) => i.isLowStock)}
      canRestock={canRestock}
    />
  );
}
