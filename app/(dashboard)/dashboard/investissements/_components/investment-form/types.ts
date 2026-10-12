export type Source = { id: string; name: string };

export type InvestmentFormValues = {
  id?: string;
  date: string;
  amount: string;
  sourceId: string;
  paymentMethod: string;
  financier: string;
  note: string;
  documentUrl: string | null;
  reimbursable: boolean;
  amountRepaid: string;
  dueDate: string;
};
