export type ExpenseItemRow = {
  id: string;
  articleId: string | null;
  /** Nom de l'article rattaché ; null si la ligne n'a jamais été rapprochée. */
  articleName: string | null;
  rawLabel: string;
  label: string | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  pendingQuantity: boolean;
};

export type ExpenseRow = {
  id: string;
  receiptNo: string | null;
  date: string;
  amount: number;
  paymentLabel: string;
  paymentMethod: string;
  supplier: string | null;
  note: string | null;
  receiptUrl: string | null;
  categoryId: string;
  categoryName: string;
  items: ExpenseItemRow[];
};
