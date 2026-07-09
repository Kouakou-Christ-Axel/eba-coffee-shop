// app/api/export/daily/route.ts
//
// Export CSV du récapitulatif journalier (commandes + CA encaissé par jour)
// sur une plage de dates (ADMIN, MANAGER, ASSISTANT_MANAGER, COMPTABLE).
// Réutilise getDailySeries.

import type { NextRequest } from 'next/server';
import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import { getDailySeries } from '@/lib/stats';
import { toCsv, csvResponse } from '@/lib/csv';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !ROLE_GROUPS.STATS.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));

  let fromStr = parseDateOnlyToUTC(sp.get('from') ?? undefined)
    ? sp.get('from')!
    : defaultFrom;
  let toStr = parseDateOnlyToUTC(sp.get('to') ?? undefined)
    ? sp.get('to')!
    : today;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const series = await getDailySeries(
    parseDateOnlyToUTC(fromStr)!,
    parseDateOnlyToUTC(toStr)!
  );

  const headers = ['Date', 'Commandes', 'CA encaissé (FCFA)'];
  const rows = series.map((p) => [p.date, p.orders, p.revenue]);

  const csv = toCsv(headers, rows);
  return csvResponse(`recap_journalier_${fromStr}_${toStr}.csv`, csv);
}
