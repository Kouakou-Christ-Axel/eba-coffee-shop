// lib/stats-operations.test.ts
//
// Heures de pointe : bucket horaire correct (heure Abidjan = composante UTC),
// 24 points même sans données, CANCELLED exclues (via le where, non re-testé
// ici) et CA limité aux commandes payées. Cuisine : durées non mesurables
// ignorées (bornes manquantes ou delta négatif), médiane pair/impair,
// moyennes null (≠ 0) sans mesure.

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
  },
}));

import prisma from '@/lib/prisma';
import { getHourlyDistribution, getKitchenPerformance } from './stats-operations';

const mockOrderFindMany = prisma.order.findMany as unknown as MockedFunction<
  (args: unknown) => Promise<unknown>
>;

const from = new Date(Date.UTC(2026, 4, 1));
const to = new Date(Date.UTC(2026, 4, 2));

const at = (iso: string) => new Date(iso);

describe('getHourlyDistribution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('agrège commandes et CA par heure UTC (= heure Abidjan)', async () => {
    mockOrderFindMany.mockResolvedValue([
      { createdAt: at('2026-05-01T08:15:00Z'), total: 1000, isPaid: true },
      { createdAt: at('2026-05-02T08:59:59Z'), total: 2000, isPaid: true },
      { createdAt: at('2026-05-01T14:00:00Z'), total: 3000, isPaid: false },
    ]);

    const points = await getHourlyDistribution(from, to);

    expect(points).toHaveLength(24);
    expect(points[8]).toEqual({ hour: 8, orders: 2, revenue: 3000 });
    // Commande non payée : comptée dans l'affluence mais pas dans le CA.
    expect(points[14]).toEqual({ hour: 14, orders: 1, revenue: 0 });
    expect(points[0]).toEqual({ hour: 0, orders: 0, revenue: 0 });
  });

  it('renvoie 24 points à zéro sans aucune commande', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    const points = await getHourlyDistribution(from, to);
    expect(points).toHaveLength(24);
    expect(points.every((p) => p.orders === 0 && p.revenue === 0)).toBe(true);
  });

  it('exclut les commandes annulées via le where', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    await getHourlyDistribution(from, to);
    expect(mockOrderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'CANCELLED' } }),
      })
    );
  });
});

describe('getKitchenPerformance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const day = new Date(Date.UTC(2026, 4, 1));

  it('mesure préparation et attente, ignore les bornes manquantes', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        // prépa 120 s, attente 60 s
        dailyDate: day,
        createdAt: at('2026-05-01T08:00:00Z'),
        preparingStartedAt: at('2026-05-01T08:01:00Z'),
        readyAt: at('2026-05-01T08:03:00Z'),
      },
      {
        // prépa 240 s, attente 0 s
        dailyDate: day,
        createdAt: at('2026-05-01T09:00:00Z'),
        preparingStartedAt: at('2026-05-01T09:00:00Z'),
        readyAt: at('2026-05-01T09:04:00Z'),
      },
      {
        // jamais passée en préparation : aucune mesure
        dailyDate: day,
        createdAt: at('2026-05-01T10:00:00Z'),
        preparingStartedAt: null,
        readyAt: null,
      },
    ]);

    const stats = await getKitchenPerformance(day, day);

    expect(stats.prep).toEqual({ measured: 2, avgSec: 180, medianSec: 180 });
    expect(stats.wait).toEqual({ measured: 2, avgSec: 30, medianSec: 30 });
    expect(stats.byDay).toEqual([
      { date: '2026-05-01', avgPrepSec: 180, measured: 2 },
    ]);
  });

  it('ignore les deltas négatifs (horodatages incohérents)', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        dailyDate: day,
        createdAt: at('2026-05-01T08:05:00Z'),
        preparingStartedAt: at('2026-05-01T08:00:00Z'), // avant createdAt
        readyAt: at('2026-05-01T07:59:00Z'), // avant preparingStartedAt
      },
    ]);

    const stats = await getKitchenPerformance(day, day);
    expect(stats.prep).toEqual({ measured: 0, avgSec: null, medianSec: null });
    expect(stats.wait).toEqual({ measured: 0, avgSec: null, medianSec: null });
  });

  it('médiane sur un nombre impair de mesures', async () => {
    mockOrderFindMany.mockResolvedValue(
      [60, 120, 600].map((prepSec) => ({
        dailyDate: day,
        createdAt: at('2026-05-01T08:00:00Z'),
        preparingStartedAt: at('2026-05-01T08:00:00Z'),
        readyAt: new Date(Date.UTC(2026, 4, 1, 8, 0, prepSec)),
      }))
    );

    const stats = await getKitchenPerformance(day, day);
    expect(stats.prep.medianSec).toBe(120);
    expect(stats.prep.avgSec).toBe(260);
  });

  it('jours sans mesure → avgPrepSec null (pas 0), série complète', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    const stats = await getKitchenPerformance(from, to);
    expect(stats.byDay).toEqual([
      { date: '2026-05-01', avgPrepSec: null, measured: 0 },
      { date: '2026-05-02', avgPrepSec: null, measured: 0 },
    ]);
    expect(stats.prep.avgSec).toBeNull();
  });
});
