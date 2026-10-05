// lib/cash-closing.test.ts
//
// `getCashFigures` : les lignes affichées à la clôture (espèces, Wave, Orange,
// autres) doivent sommer au CA total. Un mode oublié dans le détail ferait
// diverger l'écran du total sans qu'aucune erreur ne le signale.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyModeRecord } from './payment-modes';

vi.mock('@/lib/prisma', () => ({
  default: { expense: { aggregate: vi.fn() } },
}));
vi.mock('@/lib/stats', () => ({ getDailyStats: vi.fn() }));

import prisma from '@/lib/prisma';
import { getDailyStats } from '@/lib/stats';
import { getCashFigures } from './cash-closing';

const date = new Date(Date.UTC(2026, 9, 3));

function stubDay(revenueByMode: Partial<Record<string, number>>) {
  const byMode = { ...emptyModeRecord(), ...revenueByMode } as Record<
    string,
    number
  >;
  vi.mocked(getDailyStats).mockResolvedValue({
    revenue: Object.values(byMode).reduce((a, b) => a + b, 0),
    revenueByPaymentMode: byMode,
  } as never);
  vi.mocked(prisma.expense.aggregate).mockResolvedValue({
    _sum: { amount: 0 },
  } as never);
}

describe('getCashFigures', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('range MTN, Moov, Djamo et Autre dans otherSales : le détail somme au total', async () => {
    stubDay({
      CASH: 10000,
      WAVE: 5000,
      ORANGE_MONEY: 3000,
      MTN_MONEY: 1500,
      MOOV_MONEY: 700,
      DJAMO: 2500,
      OTHER: 400,
    });

    const f = await getCashFigures(date);

    expect(f.otherSales).toBe(1500 + 700 + 2500 + 400);
    expect(f.cashSales + f.waveSales + f.orangeMoneySales + f.otherSales).toBe(
      f.totalRevenue
    );
  });

  it('garde les espèces, Wave et Orange à part', async () => {
    stubDay({ CASH: 10000, WAVE: 5000, ORANGE_MONEY: 3000 });

    const f = await getCashFigures(date);

    expect(f.cashSales).toBe(10000);
    expect(f.waveSales).toBe(5000);
    expect(f.orangeMoneySales).toBe(3000);
    expect(f.otherSales).toBe(0);
  });
});
