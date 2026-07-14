import { listExpenseCategories } from '@/lib/expenses';
import { getMissingRecurringExpenses } from '@/lib/recurring-expenses';
import { RecurringAlert } from '../recurring-alert';

export async function RecurringAlertSection() {
  const [missingRecurring, categories] = await Promise.all([
    getMissingRecurringExpenses(),
    listExpenseCategories(),
  ]);
  const plainCategories = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <RecurringAlert missing={missingRecurring} categories={plainCategories} />
  );
}
