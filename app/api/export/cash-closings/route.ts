// app/api/export/cash-closings/route.ts
//
// Export CSV de l'historique des clôtures de caisse (ADMIN + CAISSE).

import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth-helpers';
import { listCashClosings } from '@/lib/cash-closing';
import { toCsv, csvResponse } from '@/lib/csv';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;
const CASHIER_ROLES = new Set(['ADMIN', 'CASHIER']);

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !CASHIER_ROLES.has(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const today = todayDateString();
  const isAll = sp.get('range') === 'all';

  let fromStr = parseDateOnlyToUTC(sp.get('from') ?? undefined)
    ? sp.get('from')!
    : shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));
  let toStr = parseDateOnlyToUTC(sp.get('to') ?? undefined)
    ? sp.get('to')!
    : today;
  if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];

  const from = isAll ? parseDateOnlyToUTC('2000-01-01')! : parseDateOnlyToUTC(fromStr)!;
  const to = parseDateOnlyToUTC(toStr)!;

  const closings = await listCashClosings(from, to);

  const headers = [
    'Date',
    'Fond de caisse',
    'Ventes espèces',
    'Dépenses espèces',
    'Caisse théorique',
    'Espèces comptées',
    'Écart',
    'Clôturé par',
    'Note',
  ];
  const rows = closings.map((c) => [
    formatLocalDateOnly(c.date),
    c.openingFloat,
    c.cashSales,
    c.cashExpenses,
    c.expectedCash,
    c.countedCash,
    c.difference,
    c.closedBy?.name ?? c.closedBy?.email ?? '',
    c.note ?? '',
  ]);

  const suffix = isAll ? 'tout' : `${fromStr}_${toStr}`;
  return csvResponse(`clotures_${suffix}.csv`, toCsv(headers, rows));
}
