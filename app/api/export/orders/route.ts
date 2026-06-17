// app/api/export/orders/route.ts
//
// Export CSV des commandes sur une plage de dates (admin-only). Réutilise les
// filtres de la page Commandes (from/to/range/status/search) via getOrdersForExport.

import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth-helpers';
import { getOrdersForExport } from '@/lib/orders';
import { toCsv, csvResponse } from '@/lib/csv';
import {
  parseDateOnlyToUTC,
  todayDateString,
  formatLocalDateOnly,
  ABIDJAN_TZ,
} from '@/lib/timezone';
import type { PaymentFilter } from '@/lib/orders';
import type { OrderStatus, OrderType } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Nouvelle',
  PREPARING: 'En cours',
  READY: 'Prête',
  COMPLETED: 'Récupérée',
  CANCELLED: 'Annulée',
};

const TYPE_LABELS: Record<OrderType, string> = {
  DELIVERY: 'Livraison',
  DINE_IN: 'Sur place',
  TAKEAWAY: 'À emporter',
};

const VALID_STATUSES = new Set<OrderStatus>([
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
]);

const VALID_PAYMENTS = new Set<PaymentFilter>([
  'unpaid',
  'CASH',
  'WAVE',
  'OTHER',
]);

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ABIDJAN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(d: Date | null): string {
  if (!d) return '';
  return dateTimeFmt.format(d).replace(',', '');
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    return new Response('Non autorisé', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  // Plage de dates (mêmes règles que la page Commandes).
  const isAll = sp.get('range') === 'all';
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  let fromStr = 'tout';
  let toStr = 'tout';
  if (!isAll) {
    const today = todayDateString();
    fromStr = parseDateOnlyToUTC(sp.get('from') ?? undefined)
      ? sp.get('from')!
      : today;
    toStr = parseDateOnlyToUTC(sp.get('to') ?? undefined)
      ? sp.get('to')!
      : fromStr;
    if (fromStr > toStr) toStr = fromStr;
    dateFrom = parseDateOnlyToUTC(fromStr);
    dateTo = parseDateOnlyToUTC(toStr);
  }

  const rawStatus = sp.get('status') as OrderStatus | null;
  const status =
    rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
  const search = sp.get('search')?.trim() || undefined;
  const rawPayment = sp.get('payment') as PaymentFilter | null;
  const payment =
    rawPayment && VALID_PAYMENTS.has(rawPayment) ? rawPayment : undefined;

  const orders = await getOrdersForExport({
    status,
    dateFrom,
    dateTo,
    search,
    payment,
  });

  const headers = [
    'Référence',
    'Jour',
    'N°',
    'Créée le',
    'Type',
    'Client',
    'Téléphone',
    'Créneau retrait',
    'Articles',
    'Total (FCFA)',
    'Payée',
    'Mode paiement',
    'Statut',
    'Note',
  ];

  const rows = orders.map((o) => [
    o.reference,
    formatLocalDateOnly(o.dailyDate),
    o.dailyNumber,
    formatDateTime(o.createdAt),
    TYPE_LABELS[o.orderType],
    o.customerName ?? '',
    o.customerPhone ?? '',
    formatDateTime(o.pickupTime),
    Array.isArray(o.items) ? o.items.length : 0,
    o.total,
    o.isPaid,
    o.paymentMode ?? '',
    STATUS_LABELS[o.status],
    o.note ?? '',
  ]);

  const csv = toCsv(headers, rows);
  const filename = `commandes_${fromStr}_${toStr}.csv`;
  return csvResponse(filename, csv);
}
