// lib/stats-customers.test.ts
//
// Agrégats clients & fidélité : récurrents = ≥ 2 commandes, taux
// d'identification sans division par zéro, top clients triés par CA,
// ajustements de tampons signés.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    customer: { count: vi.fn(), findMany: vi.fn() },
    order: { groupBy: vi.fn(), count: vi.fn() },
    loyaltyLedger: { groupBy: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getCustomerRangeStats } from './stats-customers';

const mockCustomerCount = prisma.customer.count as unknown as MockedFunction<
  () => Promise<number>
>;
const mockCustomerFindMany = prisma.customer
  .findMany as unknown as MockedFunction<() => Promise<unknown>>;
const mockOrderGroupBy = prisma.order.groupBy as unknown as MockedFunction<
  () => Promise<unknown>
>;
const mockOrderCount = prisma.order.count as unknown as MockedFunction<
  () => Promise<number>
>;
const mockLedgerGroupBy = prisma.loyaltyLedger
  .groupBy as unknown as MockedFunction<(args: unknown) => Promise<unknown>>;

const from = new Date(Date.UTC(2026, 4, 1));
const to = new Date(Date.UTC(2026, 4, 31));

describe('getCustomerRangeStats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockCustomerCount.mockResolvedValue(0);
    mockCustomerFindMany.mockResolvedValue([]);
    mockOrderGroupBy.mockResolvedValue([]);
    mockOrderCount.mockResolvedValue(0);
    mockLedgerGroupBy.mockResolvedValue([]);
  });

  it('actifs, récurrents (≥ 2 commandes) et top clients triés par CA', async () => {
    mockCustomerCount.mockResolvedValue(3);
    mockOrderGroupBy.mockResolvedValue([
      { customerId: 'c1', _count: 1, _sum: { total: 2000 } },
      { customerId: 'c2', _count: 3, _sum: { total: 9000 } },
      { customerId: 'c3', _count: 2, _sum: { total: 5000 } },
    ]);
    mockOrderCount.mockResolvedValue(10);
    mockCustomerFindMany.mockResolvedValue([
      { id: 'c1', name: 'Awa', phone: '+2250700000001' },
      { id: 'c2', name: null, phone: '+2250700000002' },
      { id: 'c3', name: 'Kof', phone: '+2250700000003' },
    ]);

    const stats = await getCustomerRangeStats(from, to, 2);

    expect(stats.newCustomers).toBe(3);
    expect(stats.activeCustomers).toBe(3);
    expect(stats.returningCustomers).toBe(2); // c2 et c3
    expect(stats.identifiedOrders).toBe(6);
    expect(stats.identificationRate).toBeCloseTo(0.6);
    // topLimit=2 : c2 (9000) puis c3 (5000).
    expect(stats.topCustomers.map((c) => c.customerId)).toEqual(['c2', 'c3']);
    expect(stats.topCustomers[0]).toMatchObject({
      name: null,
      phone: '+2250700000002',
      orders: 3,
      revenue: 9000,
    });
  });

  it('aucune commande → taux d’identification 0, listes vides', async () => {
    const stats = await getCustomerRangeStats(from, to);
    expect(stats.identificationRate).toBe(0);
    expect(stats.activeCustomers).toBe(0);
    expect(stats.topCustomers).toEqual([]);
  });

  it('agrège le ledger fidélité par type (ajustements signés)', async () => {
    mockLedgerGroupBy.mockResolvedValue([
      { type: 'STAMP_EARNED', _count: 12, _sum: { stamps: 12 } },
      { type: 'REWARD_EARNED', _count: 2, _sum: { stamps: 0 } },
      { type: 'REWARD_USED', _count: 1, _sum: { stamps: 0 } },
      { type: 'ADJUSTMENT', _count: 3, _sum: { stamps: -2 } },
    ]);

    const stats = await getCustomerRangeStats(from, to);
    expect(stats.loyalty).toEqual({
      stampsEarned: 12,
      rewardsEarned: 2,
      rewardsUsed: 1,
      adjustmentStamps: -2,
    });
  });

  it('borne le ledger sur [from, to+1j[ (instants, pas dailyDate)', async () => {
    await getCustomerRangeStats(from, to);
    expect(mockLedgerGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: from,
            lt: new Date(Date.UTC(2026, 5, 1)),
          },
        },
      })
    );
  });
});
