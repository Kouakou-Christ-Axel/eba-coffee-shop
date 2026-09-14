import { getDaysSinceLastCount, listInventoryItems } from '@/lib/inventory';
import { CountLauncher } from '../count-launcher';

export async function CountSection() {
  const [items, daysSince] = await Promise.all([
    listInventoryItems(),
    getDaysSinceLastCount(),
  ]);

  return <CountLauncher total={items.length} daysSince={daysSince} />;
}
