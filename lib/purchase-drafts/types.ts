import type {
  PreparePurchaseInput,
  PrepareOtherExpenseInput,
} from '@/lib/schemas/purchase';

export type PurchaseLineStatus = 'matched' | 'ambiguous' | 'unmatched';

export type PurchaseLineSummary = {
  rawLabel: string;
  article: string | null;
  articleId: string | null;
  candidates?: { id: string; name: string }[];
  qtyBase: number | null;
  unit: string | null;
  unitPrice: number | null;
  lineAmount: number | null;
  status: PurchaseLineStatus;
};

export type PurchaseWarningCode =
  | 'UNMATCHED_LINE'
  | 'AMBIGUOUS_LINE'
  | 'PRICE_ABERRANT'
  | 'SUM_MISMATCH'
  | 'DUPLICATE_SUSPECTED'
  | 'BULK_RECHUTE'
  | 'RECURRENCE_SUGGEST';

export type PurchaseWarning = {
  code: PurchaseWarningCode;
  message: string;
  lineIndex?: number;
};

export type PurchaseSummary = {
  lines: PurchaseLineSummary[];
  lineAmountSum: number;
  totalAmount: number | null;
};

export type PurchaseResolvedLine = {
  rawLabel: string;
  articleId: string | null;
  articleName: string | null;
  formatQty: number | null;
  formatSize: number | null;
  unit: string | null;
  unitPrice: number | null;
  amount: number | null;
  status: PurchaseLineStatus;
};

export type PurchaseDraftPayload = {
  input: PreparePurchaseInput;
  resolvedDate: string;
  summary: PurchaseSummary;
  resolvedLines: PurchaseResolvedLine[];
};

export type OtherExpenseDraftPayload = {
  input: PrepareOtherExpenseInput;
  resolvedDate: string;
};

export type DraftKind = 'purchase' | 'other_expense';
