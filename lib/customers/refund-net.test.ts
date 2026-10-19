import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { groupBy: vi.fn(), aggregate: vi.fn() },
    refund: { groupBy: vi.fn() },
    customer: { count: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { statsByCustomer } from './stats';
import { getCustomerListSummary } from './summary';

describe('CA client net des remboursements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('statsByCustomer : total dépensé = commandes − remboursements payés', async () => {
    vi.mocked(prisma.order.groupBy).mockResolvedValue([
      {
        customerId: 'c1',
        _count: 2,
        _sum: { total: 8000 },
        _max: { createdAt: null },
      },
      {
        customerId: 'c2',
        _count: 1,
        _sum: { total: 3000 },
        _max: { createdAt: null },
      },
    ] as never);
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { customerId: 'c1', _sum: { amount: 1500 } },
    ] as never);

    const stats = await statsByCustomer(['c1', 'c2']);

    expect(stats.get('c1')?.totalSpent).toBe(6500);
    expect(stats.get('c2')?.totalSpent).toBe(3000);
    expect(prisma.refund.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PAID',
          customerId: { in: ['c1', 'c2'] },
          order: { status: { not: 'CANCELLED' } },
        },
      })
    );
  });

  it('getCustomerListSummary : le CA total des clients est net', async () => {
    vi.mocked(prisma.customer.count).mockResolvedValue(0);
    vi.mocked(prisma.order.aggregate).mockResolvedValue({
      _count: 3,
      _sum: { total: 12000 },
    } as never);
    vi.mocked(prisma.order.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { customerId: 'c1', _sum: { amount: 1000 } },
      { customerId: 'c2', _sum: { amount: 500 } },
    ] as never);

    const summary = await getCustomerListSummary();

    expect(summary.revenueTotal).toBe(10500);
  });
});
