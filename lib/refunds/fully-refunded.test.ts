import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    refund: { groupBy: vi.fn() },
    orderPayment: { groupBy: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { fullyRefundedOrderIds, isFullyCovered } from './fully-refunded';

describe('isFullyCovered', () => {
  it('exige un encaissement et un remboursement qui le couvre', () => {
    expect(isFullyCovered(0, 0)).toBe(false);
    expect(isFullyCovered(1000, 400)).toBe(false);
    expect(isFullyCovered(1000, 1000)).toBe(true);
  });
});

describe('fullyRefundedOrderIds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ne requête rien pour une file vide', async () => {
    expect((await fullyRefundedOrderIds([])).size).toBe(0);
    expect(prisma.refund.groupBy).not.toHaveBeenCalled();
  });

  it('ne garde que les commandes dont les remboursements couvrent le payé', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { orderId: 'a', _sum: { amount: 2500 } },
      { orderId: 'b', _sum: { amount: 500 } },
    ] as never);
    vi.mocked(prisma.orderPayment.groupBy).mockResolvedValue([
      { orderId: 'a', _sum: { amount: 2500 } },
      { orderId: 'b', _sum: { amount: 2000 } },
    ] as never);

    const ids = await fullyRefundedOrderIds(['a', 'b', 'c']);

    expect([...ids]).toEqual(['a']);
    expect(prisma.refund.groupBy).toHaveBeenCalledWith({
      by: ['orderId'],
      where: {
        orderId: { in: ['a', 'b', 'c'] },
        status: 'PAID',
        creditSourceId: null,
      },
      _sum: { amount: true },
    });
  });

  it('saute la requête des paiements sans remboursement versé', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([] as never);
    expect((await fullyRefundedOrderIds(['a'])).size).toBe(0);
    expect(prisma.orderPayment.groupBy).not.toHaveBeenCalled();
  });
});
