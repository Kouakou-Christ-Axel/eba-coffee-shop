// lib/refunds/queries.ts
//
// Lectures des remboursements (liste filtrée, détail, file à traiter). Les
// écritures vivent dans create.ts / transitions.ts.

import type {
  Prisma,
  PaymentMode,
  RefundStatus,
} from '@/generated/prisma/client';
import prisma from '@/lib/prisma';

export type RefundFilters = {
  /** Plage sur la date de DEMANDE (inclusive, instants). */
  from?: Date;
  toExclusive?: Date;
  status?: RefundStatus[];
  channel?: PaymentMode;
  orderId?: string;
  page?: number;
  pageSize?: number;
};

/** Statuts qui demandent une action humaine. */
export const REFUND_TO_APPROVE: RefundStatus[] = ['REQUESTED'];
export const REFUND_TO_FIX: RefundStatus[] = ['FAILED', 'UNCERTAIN'];

const LIST_SELECT = {
  id: true,
  orderId: true,
  amount: true,
  reason: true,
  note: true,
  source: true,
  status: true,
  delivery: true,
  channel: true,
  destinationPhone: true,
  customerName: true,
  failureCode: true,
  failureMessage: true,
  restockItems: true,
  feeFcfa: true,
  attempt: true,
  payoutDate: true,
  paidAt: true,
  createdAt: true,
  approvedAt: true,
  order: { select: { reference: true, dailyNumber: true, total: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.RefundSelect;

function buildWhere(f: RefundFilters): Prisma.RefundWhereInput {
  return {
    ...(f.status?.length ? { status: { in: f.status } } : {}),
    ...(f.channel ? { channel: f.channel } : {}),
    ...(f.orderId ? { orderId: f.orderId } : {}),
    ...(f.from || f.toExclusive
      ? {
          createdAt: {
            ...(f.from ? { gte: f.from } : {}),
            ...(f.toExclusive ? { lt: f.toExclusive } : {}),
          },
        }
      : {}),
  };
}

export async function listRefunds(filters: RefundFilters = {}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildWhere(filters);
  const [rows, total, agg] = await Promise.all([
    prisma.refund.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.refund.count({ where }),
    prisma.refund.aggregate({ where, _sum: { amount: true } }),
  ]);
  return {
    refunds: rows,
    total,
    totalAmount: agg._sum.amount ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type RefundListItem = Awaited<
  ReturnType<typeof listRefunds>
>['refunds'][number];

export async function getRefundDetail(id: string) {
  return prisma.refund.findUnique({
    where: { id },
    include: {
      lines: true,
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { name: true, email: true } } },
      },
      order: {
        select: {
          reference: true,
          dailyNumber: true,
          total: true,
          status: true,
          isPaid: true,
          jekoAccount: true,
        },
      },
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true, email: true } },
    },
  });
}

/** Remboursements d'une commande (fiche commande). */
export async function listOrderRefunds(orderId: string) {
  return prisma.refund.findMany({
    where: { orderId },
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

/** Nombre de remboursements par file (pastille de la barre latérale, onglets). */
export async function countRefundQueues(): Promise<{
  toApprove: number;
  toFix: number;
  inProgress: number;
}> {
  const grouped = await prisma.refund.groupBy({
    by: ['status'],
    where: {
      status: {
        in: ['REQUESTED', 'FAILED', 'UNCERTAIN', 'APPROVED', 'PROCESSING'],
      },
    },
    _count: true,
  });
  const n = (statuses: RefundStatus[]) =>
    grouped
      .filter((g) => statuses.includes(g.status))
      .reduce((s, g) => s + g._count, 0);
  return {
    toApprove: n(REFUND_TO_APPROVE),
    toFix: n(REFUND_TO_FIX),
    inProgress: n(['APPROVED', 'PROCESSING']),
  };
}
