// Fabrique du client Prisma factice des tests de remboursements : `$transaction`
// rejoue le callback sur le même objet (pas de vraie transaction).

import { vi } from 'vitest';

export function refundPrismaMock() {
  const client = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    order: { findUnique: vi.fn() },
    orderPayment: { aggregate: vi.fn() },
    refund: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    refundEvent: { create: vi.fn() },
    customer: { update: vi.fn() },
    customerCreditEntry: { create: vi.fn() },
    product: { update: vi.fn() },
    supplementOption: { update: vi.fn() },
  };
  client.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === 'function' ? arg(client) : Promise.all(arg as unknown[])
  );
  return client;
}

export const admin = { id: 'admin1', role: 'ADMIN' as const };
export const cashier = { id: 'cash1', role: 'CASHIER' as const };
export const kitchen = { id: 'kit1', role: 'KITCHEN' as const };

export const baseRefund = {
  id: 'r1',
  orderId: 'o1',
  amount: 1000,
  reason: 'QUALITY',
  source: 'STAFF',
  status: 'REQUESTED',
  delivery: 'JEKO_TRANSFER',
  channel: 'WAVE',
  destinationPhone: '+2250707070707',
  customerName: 'Awa',
  requestedById: 'cash1',
  attempt: 0,
  jekoTransferId: null,
  restockItems: false,
  stockRestoredAt: null,
};

/** Client Prisma factice des tests (champs en plus selon le test, d'où l'index libre). */
export type RefundPrisma = ReturnType<typeof refundPrismaMock> &
  Record<string, unknown>;
