import { listInventoryItems, listInventoryCategories } from '@/lib/inventory';
import { InventoryTable } from '../inventory-table';

export async function ReferencesSection() {
  // Les archivées sont chargées d'emblée : le catalogue tient en une centaine
  // de lignes, et la bascule reste ainsi purement cliente — elle ne remet pas
  // l'onglet à zéro comme le ferait un paramètre d'URL.
  const [items, archived, categories] = await Promise.all([
    listInventoryItems(),
    listInventoryItems({ active: false }),
    listInventoryCategories(),
  ]);
  return (
    <InventoryTable items={items} archived={archived} categories={categories} />
  );
}
