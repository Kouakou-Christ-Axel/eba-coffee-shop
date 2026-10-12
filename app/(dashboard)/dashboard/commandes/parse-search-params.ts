import { createLoader, type SearchParams } from 'nuqs/server';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import { ordersParsers } from './search-params';

export type OrdersSearchParams = SearchParams;

const loadOrdersSearchParams = createLoader(ordersParsers);

export function parseOrdersSearchParams(params: OrdersSearchParams) {
  const raw = loadOrdersSearchParams(params);
  const page = Math.max(1, raw.page);
  const status = raw.status ?? undefined;
  const search = raw.search?.trim() || undefined;
  const payment = raw.payment ?? undefined;
  const sort = raw.sort;

  // Plage en jour civil Abidjan, défaut aujourd'hui ; `range=all` désactive le filtre de date.
  const isAll = raw.range === 'all';
  const today = todayDateString();
  let fromStr = '';
  let toStr = '';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(raw.from ?? undefined) ? raw.from! : today;
    toStr = parseDateOnlyToUTC(raw.to ?? undefined) ? raw.to! : fromStr;
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
