import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { groupBy: vi.fn(), aggregate: vi.fn() },
    refund: { groupBy: vi.fn() },
    customer: { count: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getCustomerListSummary } from './summary';

describe('CA client net des remboursements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
