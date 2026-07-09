// app/api/export/revenue-adjustments/route.ts
//
// Export CSV des régularisations de recette sur une plage de dates + mode de
// paiement (rôles finance : ADMIN, MANAGER, COMPTABLE). Miroir de
// app/api/export/expenses/route.ts.

import type { NextRequest } from 'next/server';
import type { PaymentMode } from '@/generated/prisma/client';
import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import { listRevenueAdjustments } from '@/lib/revenue-adjustments';
import { toCsv, csvResponse } from '@/lib/csv';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;
const MODES = ['CASH', 'WAVE', 'OTHER'] as const;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  OTHER: 'Autre',
};

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || !ROLE_GROUPS.FINANCE.includes(session.user.role)) {
    return new Response('Non autorisé', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const isAll = sp.get('range') === 'all';
  const today = todayDateString();
  const defaultFrom = shiftDateString(today, -(DEFAULT_RANGE_DAYS - 1));

  let fromStr = 'tout';
  let toStr = 'tout';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (!isAll) {
    fromStr = parseDateOnlyToUTC(sp.get('from') ?? undefined)
      ? sp.get('from')!
      : defaultFrom;
    toStr = parseDateOnlyToUTC(sp.get('to') ?? undefined)
      ? sp.get('to')!
      : today;
    if (fromStr > toStr) [fromStr, toStr] = [toStr, fromStr];
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }

  const modeParam = sp.get('mode');
  const paymentMode = MODES.includes(modeParam as PaymentMode)
    ? (modeParam as PaymentMode)
    : undefined;

  const { adjustments, total } = await listRevenueAdjustments({
    dateFrom,
    dateTo,
    paymentMode,
  });

  const headers = ['Date', 'Montant (FCFA)', 'Mode', 'Motif'];
  const rows = adjustments.map((a) => [
    formatLocalDateOnly(a.date),
    a.amount,
    PAYMENT_LABELS[a.paymentMode] ?? a.paymentMode,
    a.note ?? '',
  ]);
  rows.push(['', total, 'TOTAL NET', '']);

  return csvResponse(
    `regularisations_${fromStr}_${toStr}.csv`,
    toCsv(headers, rows)
  );
}
