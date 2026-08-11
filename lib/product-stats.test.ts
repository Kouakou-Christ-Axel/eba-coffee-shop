// lib/product-stats.test.ts
//
// Agrégation des ventes d'un produit depuis le JSON `Order.items`.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn() } },
}));

import prisma from '@/lib/prisma';
import { getProductStats } from './product-stats';

const mockFindMany = prisma.order.findMany as unknown as MockedFunction<
  () => Promise<unknown>
>;

const from = new Date(Date.UTC(2026, 4, 1)); // 2026-05-01
const to = new Date(Date.UTC(2026, 4, 3)); // 2026-05-03

type ItemOverrides = Partial<{
  productId: string;
  productName: string;
  basePrice: number;
  coutMatiere: number;
  coutEmballage: number;
  quantity: number;
  discount: number;
  supplements: {
    groupName: string;
    optionName: string;
    price: number;
    quantity?: number;
  }[];
}>;

function item(overrides: ItemOverrides = {}) {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Latte',
    basePrice: 1000,
    coutMatiere: 200,
    coutEmballage: 50,
    quantity: 1,
    supplements: [],
    discount: 0,
    ...overrides,
  };
}

function order(day: number, items: ReturnType<typeof item>[]) {
  return { dailyDate: new Date(Date.UTC(2026, 4, day)), items };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProductStats', () => {
  it('agrège quantité, CA, coût et marge sur les lignes du produit', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [item({ quantity: 2 }), item({ productId: 'p2' })]),
      order(2, [item({ quantity: 3 })]),
    ]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.quantity).toBe(5);
    expect(stats.orders).toBe(2);
    expect(stats.revenue).toBe(5000);
    expect(stats.cost).toBe(1250); // 250 × 5
    expect(stats.margin).toBe(3750);
    expect(stats.quantityWithoutCost).toBe(0);
  });

  it('compte une seule commande même si le produit y figure sur deux lignes', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [item({ cartId: 'a' }), item({ cartId: 'b', quantity: 4 })]),
    ]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.orders).toBe(1);
    expect(stats.quantity).toBe(5);
    expect(stats.avgQuantityPerOrder).toBe(5);
  });

  it('valorise les suppléments au prix × quantité d’option', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [
        item({
          quantity: 2,
          supplements: [
            {
              groupName: 'Goûts',
              optionName: 'Vanille',
              price: 100,
              quantity: 3,
            },
          ],
        }),
      ]),
    ]);

    const stats = await getProductStats('p1', from, to);

    // (1000 + 100 × 3) × 2
    expect(stats.revenue).toBe(2600);
    expect(stats.topSupplements).toEqual([
      { groupName: 'Goûts', optionName: 'Vanille', quantity: 6 },
    ]);
  });

  it('retranche la remise de ligne du CA', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [item({ quantity: 2, discount: 400 })]),
    ]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.revenue).toBe(1600);
  });

  it('signale les unités vendues sans coût enregistré', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [item({ quantity: 2, coutMatiere: 0, coutEmballage: 0 })]),
      order(2, [item({ quantity: 1 })]),
    ]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.quantityWithoutCost).toBe(2);
    expect(stats.cost).toBe(250);
  });

  it('remplit les jours sans vente à zéro et retient le dernier jour vendu', async () => {
    mockFindMany.mockResolvedValue([order(1, [item({ quantity: 2 })])]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.rangeDays).toBe(3);
    expect(stats.series).toEqual([
      { date: '2026-05-01', quantity: 2, revenue: 2000 },
      { date: '2026-05-02', quantity: 0, revenue: 0 },
      { date: '2026-05-03', quantity: 0, revenue: 0 },
    ]);
    expect(stats.daysWithSales).toBe(1);
    expect(stats.lastSoldOn).toBe('2026-05-01');
  });

  it('calcule la part de CA et le rang parmi tous les produits vendus', async () => {
    mockFindMany.mockResolvedValue([
      order(1, [
        item({ productId: 'p1', quantity: 1 }), // 1000
        item({ productId: 'p2', quantity: 3 }), // 3000
      ]),
    ]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.soldProductCount).toBe(2);
    expect(stats.quantityRank).toBe(2);
    expect(stats.revenueShare).toBeCloseTo(0.25);
  });

  it('renvoie des compteurs vides et aucun rang quand le produit n’a rien vendu', async () => {
    mockFindMany.mockResolvedValue([order(1, [item({ productId: 'p2' })])]);

    const stats = await getProductStats('p1', from, to);

    expect(stats.quantity).toBe(0);
    expect(stats.orders).toBe(0);
    expect(stats.revenue).toBe(0);
    expect(stats.margin).toBe(0);
    expect(stats.quantityRank).toBeNull();
    expect(stats.revenueShare).toBe(0);
    expect(stats.lastSoldOn).toBeNull();
    expect(stats.avgQuantityPerOrder).toBe(0);
  });

  it('exclut les commandes annulées via la requête', async () => {
    mockFindMany.mockResolvedValue([]);

    await getProductStats('p1', from, to);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'CANCELLED' },
          dailyDate: { gte: from, lte: to },
        }),
      })
    );
  });
});
