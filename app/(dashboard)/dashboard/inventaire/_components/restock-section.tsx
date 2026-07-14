import { listInventoryItems } from '@/lib/inventory';
import { listExpenseCategories } from '@/lib/expenses';
import { RestockGrid } from '../restock-grid';

export async function RestockSection() {
  const [items, expenseCats] = await Promise.all([
    listInventoryItems(),
    listExpenseCategories(),
  ]);
  const expenseCategories = expenseCats.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  return <RestockGrid items={items} expenseCategories={expenseCategories} />;
}
