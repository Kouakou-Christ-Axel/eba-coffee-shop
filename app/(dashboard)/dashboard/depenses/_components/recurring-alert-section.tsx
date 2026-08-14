import { getMissingRecurringExpenses } from '@/lib/recurring-expenses';
import { RecurringAlert } from '../recurring-alert';

export async function RecurringAlertSection() {
  const missingRecurring = await getMissingRecurringExpenses();

  return <RecurringAlert missing={missingRecurring} />;
}
