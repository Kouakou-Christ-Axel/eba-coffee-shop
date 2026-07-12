// lib/stats-compare.test.ts
//
// Vérifie les maths de comparaison de période (deltas, période précédente)
// et la symétrie des conventions (régularisations incluses dans le CA des
// DEUX périodes comparées).

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

vi.mock('@/lib/expenses', () => ({
  getExpenseSummary: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { getExpenseSummary } from '@/lib/expenses';
import {
  computeDelta,
  previousRange,
  compareRanges,
  compareDays,
} from './stats-compare';

type FindManyArgs = { where: { dailyDate: Date | { gte: Date; lte: Date } } };

const mockOrderFindMany = prisma.order.findMany as unknown as MockedFunction<
  (args: FindManyArgs) => Promise<unknown>
>;
const mockAdjGroupBy = prisma.revenueAdjustment
  .groupBy as unknown as MockedFunction<() => Promise<unknown>>;
const mockExpenseSummary = getExpenseSummary as unknown as MockedFunction<
  (filters: {
    dateFrom: Date;
    dateTo: Date;
  }) => Promise<{ total: number; byCategory: [] }>
>;

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

const paidOrder = (total: number) => ({
  status: 'COMPLETED',
  orderType: 'TAKEAWAY',
  isPaid: true,
  paymentMode: 'CASH',
  total,
});

describe('computeDelta', () => {
  it('calcule diff et pct signés', () => {
    expect(computeDelta(120, 100)).toEqual({
      current: 120,
      previous: 100,
      diff: 20,
      pct: 0.2,
    });
    expect(computeDelta(50, 100).pct).toBeCloseTo(-0.5);
    expect(computeDelta(50, 100).diff).toBe(-50);
  });

  it('renvoie pct null quand previous vaut 0 (jamais Infinity/NaN)', () => {
    expect(computeDelta(100, 0).pct).toBeNull();
    expect(computeDelta(0, 0).pct).toBeNull();
    expect(computeDelta(100, 0).diff).toBe(100);
  });
});

describe('previousRange', () => {
  it('un seul jour → la veille', () => {
    const { from, to } = previousRange(utc(2026, 5, 10), utc(2026, 5, 10));
    expect(from).toEqual(utc(2026, 5, 9));
    expect(to).toEqual(utc(2026, 5, 9));
  });

  it('30 jours → les 30 jours précédents, contigus', () => {
    const { from, to } = previousRange(utc(2026, 4, 11), utc(2026, 5, 10));
    expect(to).toEqual(utc(2026, 4, 10));
    expect(from).toEqual(utc(2026, 3, 12));
  });

  it('franchit les mois et années sans trou', () => {
    const { from, to } = previousRange(utc(2026, 1, 1), utc(2026, 1, 7));
    expect(to).toEqual(utc(2025, 12, 31));
    expect(from).toEqual(utc(2025, 12, 25));
  });
});

describe('compareRanges', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('applique les régularisations aux DEUX périodes et calcule les deltas', async () => {
    const from = utc(2026, 5, 8);
    const to = utc(2026, 5, 10); // 3 jours → période précédente = 5..7 mai

    // Période courante : 2 commandes (3000) ; précédente : 1 commande (1000).
    mockOrderFindMany.mockImplementation(async (args) => {
      const range = args.where.dailyDate as { gte: Date };
      return range.gte.getTime() === from.getTime()
        ? [paidOrder(1000), paidOrder(2000)]
        : [paidOrder(1000)];
    });
    // Régularisation +500 CASH sur chaque période (symétrie du mécanisme).
    mockAdjGroupBy.mockResolvedValue([
      { paymentMode: 'CASH', _sum: { amount: 500 } },
    ]);
    mockExpenseSummary.mockImplementation(async (f) =>
      f.dateFrom.getTime() === from.getTime()
        ? { total: 800, byCategory: [] }
        : { total: 400, byCategory: [] }
    );

    const cmp = await compareRanges(from, to);

    expect(cmp.previousFrom).toEqual(utc(2026, 5, 5));
    expect(cmp.previousTo).toEqual(utc(2026, 5, 7));
    // CA = commandes + régularisation, sur les deux périodes.
    expect(cmp.deltas.revenue.current).toBe(3500);
    expect(cmp.deltas.revenue.previous).toBe(1500);
    expect(cmp.deltas.revenue.pct).toBeCloseTo(2000 / 1500);
    expect(cmp.deltas.totalOrders).toMatchObject({ current: 2, previous: 1 });
    // Marge nette = CA − dépenses, période par période.
    expect(cmp.deltas.netMargin.current).toBe(3500 - 800);
    expect(cmp.deltas.netMargin.previous).toBe(1500 - 400);
    expect(cmp.expenses.current.total).toBe(800);
    expect(cmp.expenses.previous.total).toBe(400);
  });

  it('période précédente vide → deltas pct null', async () => {
    const from = utc(2026, 5, 10);
    const to = utc(2026, 5, 10);
    mockOrderFindMany.mockImplementation(async (args) => {
      const range = args.where.dailyDate as { gte: Date };
      return range.gte.getTime() === from.getTime() ? [paidOrder(1000)] : [];
    });
    mockAdjGroupBy.mockResolvedValue([]);
    mockExpenseSummary.mockResolvedValue({ total: 0, byCategory: [] });

    const cmp = await compareRanges(from, to);
    expect(cmp.deltas.revenue.pct).toBeNull();
    expect(cmp.deltas.totalOrders.pct).toBeNull();
    expect(cmp.deltas.cancellationRatePts.diffPts).toBe(0);
  });

  it("compare le taux d'annulation en points", async () => {
    const from = utc(2026, 5, 8);
    const to = utc(2026, 5, 10);
    mockOrderFindMany.mockImplementation(async (args) => {
      const range = args.where.dailyDate as { gte: Date };
      // Courante : 1 annulée sur 4 (25 %) ; précédente : 1 sur 2 (50 %).
      return range.gte.getTime() === from.getTime()
        ? [
            paidOrder(1000),
            paidOrder(1000),
            paidOrder(1000),
            { ...paidOrder(1000), status: 'CANCELLED', isPaid: false },
          ]
        : [
            paidOrder(1000),
            { ...paidOrder(1000), status: 'CANCELLED', isPaid: false },
          ];
    });
    mockAdjGroupBy.mockResolvedValue([]);
    mockExpenseSummary.mockResolvedValue({ total: 0, byCategory: [] });

    const cmp = await compareRanges(from, to);
    expect(cmp.deltas.cancellationRatePts.current).toBeCloseTo(0.25);
    expect(cmp.deltas.cancellationRatePts.previous).toBeCloseTo(0.5);
    expect(cmp.deltas.cancellationRatePts.diffPts).toBeCloseTo(-0.25);
  });
});

describe('compareDays', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('compare aujourd’hui à hier et au même jour de la semaine dernière', async () => {
    const today = utc(2026, 5, 10);
    const byDay = new Map([
      [utc(2026, 5, 10).getTime(), [paidOrder(2000)]],
      [utc(2026, 5, 9).getTime(), [paidOrder(1000)]],
      [utc(2026, 5, 3).getTime(), [paidOrder(4000)]],
    ]);
    mockOrderFindMany.mockImplementation(
      async (args) => byDay.get((args.where.dailyDate as Date).getTime()) ?? []
    );
    mockAdjGroupBy.mockResolvedValue([]);

    const cmp = await compareDays(today);
    expect(cmp.vsYesterday.revenue.pct).toBeCloseTo(1);
    expect(cmp.vsLastWeek.revenue.pct).toBeCloseTo(-0.5);
    expect(cmp.vsYesterday.orders).toMatchObject({ current: 1, previous: 1 });
  });
});
