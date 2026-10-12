export type PendingOrder = {
  id: string;
  dailyNumber: number;
  reference: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  paymentAttempts: number;
  paymentExpiresAt: string;
  createdAt: string;
};
