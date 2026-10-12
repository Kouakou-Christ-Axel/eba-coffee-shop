import { PAYMENT_MODES } from '@/lib/payment-modes';
import { type OrderSort, type PaymentFilter } from '@/lib/orders';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import { type OrderStatus } from '@/generated/prisma/client';

const VALID_STATUSES = new Set<OrderStatus>([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

const VALID_PAYMENTS = new Set<PaymentFilter>(['unpaid', ...PAYMENT_MODES]);

const VALID_SORTS = new Set<OrderSort>([
  'recent',
  'oldest',
  'total_desc',
  'total_asc',
  'number',
]);

export type OrdersSearchParams = {
  page?: string;
  status?: string;
  from?: string;
  to?: string;
  range?: string;
  search?: string;
  payment?: string;
  sort?: string;
};

export function parseOrdersSearchParams(params: OrdersSearchParams) {
  const page = Math.max(1, Number(params.page ?? 1));
  const rawStatus = params.status as OrderStatus | undefined;
  const status =
    rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
  const search = params.search?.trim() || undefined;
  const rawPayment = params.payment as PaymentFilter | undefined;
  const payment =
    rawPayment && VALID_PAYMENTS.has(rawPayment) ? rawPayment : undefined;
  const rawSort = params.sort as OrderSort | undefined;
  const sort = rawSort && VALID_SORTS.has(rawSort) ? rawSort : 'recent';

  // Plage en jour civil Abidjan, défaut aujourd'hui ; `range=all` désactive le filtre de date.
  const isAll = params.range === 'all';
  const today = todayDateString();
  let fromStr = '';
  let toStr = '';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(params.from) ? params.from! : today;
    toStr = parseDateOnlyToUTC(params.to) ? params.to! : fromStr;
    if (fromStr > toStr) toStr = fromStr; // YYYY-MM-DD comparable lexicalement
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }
  return {
    page,
    status,
    search,
    payment,
    sort,
    isAll,
    today,
    fromStr,
    toStr,
    dateFrom,
    dateTo,
  };
}
