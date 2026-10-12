export type ArticleHistoryLine = {
  id: string;
  rawLabel: string;
  label: string | null;
  qtyBase: number | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number;
  pendingQuantity: boolean;
  date: string;
  receiptNo: string | null;
  supplier: string | null;
  paymentMethod: string;
  categoryName: string;
};

export type ArticleOption = { id: string; name: string };
