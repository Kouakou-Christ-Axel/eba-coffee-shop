import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    refund: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { countRefundQueues, listRefunds } from './queries';

describe('listRefunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.refund.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.refund.count).mockResolvedValue(45);
    vi.mocked(prisma.refund.aggregate).mockResolvedValue({
      _sum: { amount: 9000 },
    } as never);
  });

  it('pagine et plafonne la taille de page', async () => {
    const r = await listRefunds({ page: 3, pageSize: 500 });
    expect(r).toMatchObject({
      page: 3,
      pageSize: 100,
      totalPages: 1,
      total: 45,
    });
    const q = vi.mocked(prisma.refund.findMany).mock.calls[0][0]!;
    expect(q.skip).toBe(200);
    expect(q.take).toBe(100);
  });

  it('filtre par statut, canal, commande et plage de demande', async () => {
    const from = new Date(Date.UTC(2026, 9, 1));
    const toExclusive = new Date(Date.UTC(2026, 9, 4));
    await listRefunds({
      status: ['FAILED', 'UNCERTAIN'],
      channel: 'WAVE',
      orderId: 'o1',
      from,
      toExclusive,
    });
    expect(vi.mocked(prisma.refund.count)).toHaveBeenCalledWith({
      where: {
        status: { in: ['FAILED', 'UNCERTAIN'] },
        channel: 'WAVE',
        orderId: 'o1',
        createdAt: { gte: from, lt: toExclusive },
      },
    });
  });
});

describe('countRefundQueues', () => {
  it('regroupe les statuts en files à valider / à corriger / en cours', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { status: 'REQUESTED', _count: 3 },
      { status: 'FAILED', _count: 1 },
      { status: 'UNCERTAIN', _count: 2 },
      { status: 'APPROVED', _count: 1 },
      { status: 'PROCESSING', _count: 4 },
    ] as never);
    await expect(countRefundQueues()).resolves.toEqual({
      toApprove: 3,
      toFix: 3,
      inProgress: 5,
    });
  });
});
