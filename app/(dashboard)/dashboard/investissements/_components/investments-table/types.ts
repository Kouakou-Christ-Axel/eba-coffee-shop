export type Source = { id: string; name: string };
export type SourceWithCount = Source & { _count: { investments: number } };

export type InvestmentRow = {
  id: string;
  date: string;
  amount: number;
  paymentLabel: string;
  paymentMethod: string;
  sourceId: string;
  sourceName: string;
  financier: string | null;
  note: string | null;
  documentUrl: string | null;
  reimbursable: boolean;
  amountRepaid: number;
  outstanding: number;
  dueDate: string | null;
};
