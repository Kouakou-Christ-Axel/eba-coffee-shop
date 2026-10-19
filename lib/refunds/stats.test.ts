import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    refund: { findMany: vi.fn(), groupBy: vi.fn() },
    refundLine: { findMany: vi.fn() },
  },
}));
vi.mock('@/lib/stats', () => ({ getRangeStats: vi.fn() }));
vi.mock('./queries', () => ({ countRefundQueues: vi.fn() }));

import prisma from '@/lib/prisma';
import { getRangeStats } from '@/lib/stats';
import { countRefundQueues } from './queries';
import { getRefundStats } from './stats';

const from = new Date(Date.UTC(2026, 9, 1));
const to = new Date(Date.UTC(2026, 9, 31));
const user = (id: string, name: string) => ({ id, name });
const counted = { isPaid: true, status: 'COMPLETED' };

describe('getRefundStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRangeStats).mockResolvedValue({
      grossRevenue: 100000,
    } as never);
    vi.mocked(countRefundQueues).mockResolvedValue({
      toApprove: 2,
      toFix: 1,
      inProgress: 0,
    });
    vi.mocked(prisma.refundLine.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.refund.findMany)
      // 1er appel : remboursements payés ; 2e : validations.
      .mockResolvedValueOnce([
        {
          amount: 3000,
          reason: 'QUALITY',
          channel: 'WAVE',
          feeFcfa: 30,
          order: counted,
          requestedBy: user('u1', 'Awa'),
          approvedBy: user('u9', 'Chef'),
        },
        {
          amount: 1000,
          reason: 'QUALITY',
          channel: 'CASH',
          feeFcfa: 0,
          order: counted,
          requestedBy: user('u1', 'Awa'),
          approvedBy: user('u9', 'Chef'),
        },
        {
          amount: 500,
          reason: 'PRICE_ERROR',
          channel: 'CASH',
          feeFcfa: 0,
          // Commande annulée depuis : n'est plus dans le CA, ne compte pas dans le taux.
          order: { isPaid: true, status: 'CANCELLED' },
          requestedBy: null,
          approvedBy: user('u9', 'Chef'),
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          createdAt: new Date('2026-10-02T10:00:00Z'),
          approvedAt: new Date('2026-10-02T10:30:00Z'),
        },
        {
          createdAt: new Date('2026-10-03T10:00:00Z'),
          approvedAt: new Date('2026-10-03T10:10:00Z'),
        },
      ] as never);
  });

  it('totaux, répartitions, coût et files', async () => {
    const stats = await getRefundStats(from, to);

    expect(stats.count).toBe(3);
    expect(stats.amount).toBe(4500);
    expect(stats.transferFees).toBe(30);
    expect(stats.byChannel.WAVE).toBe(3000);
    expect(stats.byChannel.CASH).toBe(1500);
    expect(stats.byReason).toEqual([
      { reason: 'QUALITY', count: 2, amount: 4000 },
      { reason: 'PRICE_ERROR', count: 1, amount: 500 },
    ]);
    expect(stats.byRequester[0]).toEqual({
      name: 'Awa',
      count: 2,
      amount: 4000,
    });
    expect(stats.byApprover[0]).toEqual({
      name: 'Chef',
      count: 3,
      amount: 4500,
    });
    expect(stats.avgApprovalMinutes).toBe(20);
    expect(stats.queues.toApprove).toBe(2);
  });

  it('le taux ne compte que les remboursements dont la commande est encore dans le CA', async () => {
    const stats = await getRefundStats(from, to);
    expect(stats.rateOfGrossRevenue).toBeCloseTo(0.04); // 4 000 / 100 000
  });

  it('taux d’échec des transferts : échec + à vérifier sur les transferts tentés', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { status: 'PAID', _count: 6 },
      { status: 'FAILED', _count: 1 },
      { status: 'UNCERTAIN', _count: 1 },
    ] as never);
    const stats = await getRefundStats(from, to);
    expect(stats.transferFailureRate).toBeCloseTo(0.25);
  });

  it('agrège par produit via les lignes rattachées', async () => {
    vi.mocked(prisma.refundLine.findMany).mockResolvedValue([
      {
        name: 'Café',
        kind: 'PRODUCT',
        productId: 'p1',
        quantity: 1,
        amount: 400,
      },
      {
        name: 'Café',
        kind: 'PRODUCT',
        productId: 'p1',
        quantity: 2,
        amount: 800,
      },
      {
        name: 'Avoine',
        kind: 'SUPPLEMENT',
        productId: 'p1',
        quantity: 1,
        amount: 100,
      },
    ] as never);
    const stats = await getRefundStats(from, to);
    expect(stats.byProduct[0]).toEqual({
      name: 'Café',
      quantity: 3,
      amount: 1200,
    });
    expect(stats.byProduct).toHaveLength(2);
  });

  it('aucun remboursement : zéros, pas de division par zéro', async () => {
    vi.mocked(prisma.refund.findMany).mockReset();
    vi.mocked(prisma.refund.findMany).mockResolvedValue([] as never);
    vi.mocked(getRangeStats).mockResolvedValue({ grossRevenue: 0 } as never);
    const stats = await getRefundStats(from, to);
    expect(stats).toMatchObject({
      count: 0,
      amount: 0,
      rateOfGrossRevenue: 0,
      transferFailureRate: 0,
      avgApprovalMinutes: null,
    });
  });
});
