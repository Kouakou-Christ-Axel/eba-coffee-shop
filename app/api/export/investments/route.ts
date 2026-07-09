// app/api/export/investments/route.ts
//
// Export CSV des investissements (apports / financements) sur une plage de dates
// + source (rôles finance : ADMIN, MANAGER, COMPTABLE). Miroir de
// app/api/export/expenses/route.ts.

import type { NextRequest } from 'next/server';
import { getCurrentSession, ROLE_GROUPS } from '@/lib/auth-helpers';
import { listInvestments } from '@/lib/investments';
import { toCsv, csvResponse } from '@/lib/csv';
import {
  parseDateOnlyToUTC,
  todayDateString,
  shiftDateString,
  formatLocalDateOnly,
} from '@/lib/timezone';

export const dynamic = 'force-dynamic';

const DEFAULT_RANGE_DAYS = 30;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  BANK: 'Banque',
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

  const sourceId = sp.get('source') || undefined;
  const { investments, total, totalOutstanding } = await listInvestments({
    dateFrom,
    dateTo,
    sourceId,
  });

  const headers = [
    'Date',
    'Source',
    'Montant (FCFA)',
    'Canal',
    'Financeur',
    'À rembourser',
    'Remboursé (FCFA)',
    'Restant dû (FCFA)',
    'Échéance',
    'Note',
    'Justificatif',
  ];
  const rows = investments.map((i) => [
    formatLocalDateOnly(i.date),
    i.source.name,
    i.amount,
    PAYMENT_LABELS[i.paymentMethod] ?? i.paymentMethod,
    i.financier ?? '',
    i.reimbursable ? 'Oui' : 'Non',
    i.reimbursable ? i.amountRepaid : '',
    i.reimbursable ? Math.max(0, i.amount - i.amountRepaid) : '',
    i.dueDate ? formatLocalDateOnly(i.dueDate) : '',
    i.note ?? '',
    i.documentUrl ?? '',
  ]);
  // Ligne de total (montant investi + restant dû).
  rows.push(['', 'TOTAL', total, '', '', '', '', totalOutstanding, '', '', '']);

  return csvResponse(
    `investissements_${fromStr}_${toStr}.csv`,
    toCsv(headers, rows)
  );
}
