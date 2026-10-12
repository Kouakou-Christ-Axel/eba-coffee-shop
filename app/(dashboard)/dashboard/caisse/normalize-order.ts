import type { CashierOrder } from '@/lib/cashier-queue';
import { normalizeOrderDates } from '@/lib/orders/format';

type RawCashierOrder = Omit<
  CashierOrder,
  | 'pickupTime'
  | 'createdAt'
  | 'preparingStartedAt'
  | 'readyAt'
  | 'stockReservedAt'
> & {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt: string | null;
  readyAt: string | null;
  stockReservedAt: string | null;
};

/** Reconstitue les `Date` d'une commande reçue par SSE (JSON : chaînes ISO). */
export function normalize(raw: unknown): CashierOrder {
  return normalizeOrderDates(raw as RawCashierOrder);
}
