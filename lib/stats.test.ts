// lib/stats.test.ts
//
// Vérifie l'injection des régularisations de recette dans le CA agrégé :
// elles s'ajoutent à `revenue` et `revenueByPaymentMode`, MAIS pas aux
// compteurs de commandes ni au panier moyen.

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
    order: { findMany: vi.fn() },
    revenueAdjustment: { groupBy: vi.fn(), findMany: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getRangeStats, getDailySeries, getDailyStats } from './stats';

const mockOrderFindMany = prisma.order.findMany as unknown as MockedFunction<
  () => Promise<unknown>
>;
const mockAdjGroupBy = prisma.revenueAdjustment
  .groupBy as unknown as MockedFunction<() => Promise<unknown>>;
const mockAdjFindMany = prisma.revenueAdjustment
  .findMany as unknown as MockedFunction<() => Promise<unknown>>;

const from = new Date(Date.UTC(2026, 4, 1)); // 2026-05-01
const to = new Date(Date.UTC(2026, 4, 1));

describe('getRangeStats avec régularisations de recette', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ajoute les régularisations au CA et par mode, sans toucher paidOrders/avgBasket', async () => {
    // 2 commandes payées : 1000 (CASH) + 2000 (WAVE) → CA commandes = 3000.
    mockOrderFindMany.mockResolvedValue([
      {
        status: 'COMPLETED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'CASH',
        total: 1000,
      },
      {
        status: 'COMPLETED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'WAVE',
        total: 2000,
      },
    ]);
    // Régularisation : +80 000 en espèces.
    mockAdjGroupBy.mockResolvedValue([
      { paymentMode: 'CASH', _sum: { amount: 80000 } },
    ]);

    const stats = await getRangeStats(from, to);

    // CA total inclut la régularisation.
    expect(stats.revenue).toBe(3000 + 80000);
    expect(stats.revenueByPaymentMode.CASH).toBe(1000 + 80000);
    expect(stats.revenueByPaymentMode.WAVE).toBe(2000);
    // Compteurs de commandes inchangés.
    expect(stats.paidOrders).toBe(2);
    expect(stats.totalOrders).toBe(2);
    // Panier moyen = CA DES COMMANDES / paidOrders (hors régularisation).
    expect(stats.avgBasket).toBe(1500);
  });

  it('gère une régularisation négative (retrait de CA)', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        status: 'COMPLETED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'CASH',
        total: 5000,
      },
    ]);
    mockAdjGroupBy.mockResolvedValue([
      { paymentMode: 'CASH', _sum: { amount: -2000 } },
    ]);

    const stats = await getRangeStats(from, to);
    expect(stats.revenue).toBe(3000);
    expect(stats.revenueByPaymentMode.CASH).toBe(3000);
    expect(stats.avgBasket).toBe(5000); // commande uniquement
  });
});

describe('exclusion des commandes annulées du CA', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getDailyStats n'ajoute pas au CA une commande annulée restée isPaid", async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        status: 'COMPLETED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'CASH',
        total: 1000,
      },
      {
        status: 'CANCELLED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'CASH',
        total: 5000,
      },
    ]);
    mockAdjGroupBy.mockResolvedValue([]);

    const stats = await getDailyStats(from);
    expect(stats.revenue).toBe(1000);
    expect(stats.paidOrders).toBe(1);
    expect(stats.cancelledOrders).toBe(1);
    expect(stats.totalOrders).toBe(2);
  });

  it("getRangeStats n'ajoute pas au CA une commande annulée restée isPaid", async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        status: 'CANCELLED',
        orderType: 'TAKEAWAY',
        isPaid: true,
        paymentMode: 'WAVE',
        total: 5000,
      },
    ]);
    mockAdjGroupBy.mockResolvedValue([]);

    const stats = await getRangeStats(from, to);
    expect(stats.revenue).toBe(0);
    expect(stats.paidOrders).toBe(0);
    expect(stats.cancelledOrders).toBe(1);
  });

  it("getDailySeries n'ajoute pas au CA une commande annulée restée isPaid", async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        dailyDate: new Date(Date.UTC(2026, 4, 1)),
        total: 5000,
        isPaid: true,
        status: 'CANCELLED',
      },
    ]);
    mockAdjFindMany.mockResolvedValue([]);

    const series = await getDailySeries(from, to);
    expect(series[0].revenue).toBe(0);
    expect(series[0].orders).toBe(1);
  });
});

describe('getDailySeries avec régularisations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('ajoute la régularisation au CA du jour sans incrémenter les commandes', async () => {
    mockOrderFindMany.mockResolvedValue([
      { dailyDate: new Date(Date.UTC(2026, 4, 1)), total: 1000, isPaid: true },
    ]);
    mockAdjFindMany.mockResolvedValue([
      { date: new Date(Date.UTC(2026, 4, 1)), amount: 80000 },
    ]);

    const series = await getDailySeries(from, to);
    expect(series).toHaveLength(1);
    expect(series[0].revenue).toBe(1000 + 80000);
    expect(series[0].orders).toBe(1);
  });
});
