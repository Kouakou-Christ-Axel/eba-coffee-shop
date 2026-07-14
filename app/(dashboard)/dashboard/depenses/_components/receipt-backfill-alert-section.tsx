import { countUnnumberedExpenses } from '@/lib/expenses';
import { ReceiptBackfillAlert } from '../receipt-backfill-alert';

export async function ReceiptBackfillAlertSection() {
  const unnumberedCount = await countUnnumberedExpenses();
  return <ReceiptBackfillAlert count={unnumberedCount} />;
}
