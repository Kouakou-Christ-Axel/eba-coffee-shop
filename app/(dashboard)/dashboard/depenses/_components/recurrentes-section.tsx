import { listExpenseCategories } from '@/lib/expenses';
import { listRecurringExpenses } from '@/lib/recurring-expenses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecurringManager } from '../recurring-manager';

export async function RecurrentesSection() {
  const [recurringList, categories] = await Promise.all([
    listRecurringExpenses(),
    listExpenseCategories(),
  ]);

  const recurringRows = recurringList.map((r) => ({
    id: r.id,
    label: r.label,
    categoryId: r.categoryId,
    categoryName: r.category.name,
    expectedAmount: r.expectedAmount,
    active: r.active,
  }));
  const plainCategories = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Dépenses récurrentes (aide-mémoire)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <RecurringManager
          recurring={recurringRows}
          categories={plainCategories}
        />
      </CardContent>
    </Card>
  );
}
