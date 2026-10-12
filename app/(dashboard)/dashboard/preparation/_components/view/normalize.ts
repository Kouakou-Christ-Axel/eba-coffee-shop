import { type PreparationOrder } from '@/lib/preparation-queue';
import { normalizeOrderDates } from '@/lib/orders/format';

type RawPreparationOrder = Omit<
  PreparationOrder,
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

export function normalize(raw: unknown): PreparationOrder {
  return normalizeOrderDates(raw as RawPreparationOrder);
}
