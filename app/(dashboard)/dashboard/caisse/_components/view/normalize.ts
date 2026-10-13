import type { CashierOrder } from '@/lib/cashier-queue';
import { normalizeOrderDates } from '@/lib/orders/format';

type RawCashierOrder = Omit<
  CashierOrder,
  | 'pickupTime'
  | 'createdAt'
  | 'preparingStartedAt'
  | 'readyAt'
  | 'stockReservedAt'
  | 'driverRequestedAt'
> & {
  pickupTime: string | null;
  createdAt: string;
  preparingStartedAt: string | null;
  readyAt: string | null;
  stockReservedAt: string | null;
  driverRequestedAt: string | null;
};

export function normalize(raw: unknown): CashierOrder {
  const r = raw as RawCashierOrder;
  return {
    ...normalizeOrderDates(r),
    driverRequestedAt: r.driverRequestedAt
      ? new Date(r.driverRequestedAt)
      : null,
  };
}
