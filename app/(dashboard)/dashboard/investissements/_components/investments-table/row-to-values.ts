import { todayDateString } from '@/lib/timezone';
import type { InvestmentFormValues } from '../../investment-form';
import type { InvestmentRow } from './types';

export function rowToValues(
  r: InvestmentRow,
  mode: 'edit' | 'duplicate'
): InvestmentFormValues {
  return {
    id: mode === 'edit' ? r.id : undefined,
    date: mode === 'duplicate' ? todayDateString() : r.date,
    amount: String(r.amount),
    sourceId: r.sourceId,
    paymentMethod: r.paymentMethod,
    financier: r.financier ?? '',
    note: r.note ?? '',
    documentUrl: mode === 'duplicate' ? null : r.documentUrl,
    reimbursable: r.reimbursable,
    amountRepaid: r.reimbursable ? String(r.amountRepaid) : '',
    dueDate: r.dueDate ?? '',
  };
}
