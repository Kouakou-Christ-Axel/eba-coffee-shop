// lib/menu-popularity.test.ts
import { describe, it, expect, vi } from 'vitest';

// `attachPopularity` est pur, mais son module importe le client Prisma pour
// `getProductPopularity` — on le neutralise pour garder le test hors DB.
vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn() } },
}));

import type { MenuCategory, Product } from '@/config/menu';
import {
  attachPopularity,
  type ProductPopularity,
} from '@/lib/menu-popularity';
import {
  POPULARITY_MIN_ORDERS,
  POPULARITY_RANKED_COUNT,
} from '@/config/constants';

function product(id: string): Product {
  return { id, name: id, description: `Description ${id}`, price: 1000 };
}

const menu: MenuCategory[] = [
  {
    id: 'boissons',
    name: 'Boissons',
    products: [product('a'), product('b'), product('c')],
  },
  { id: 'patisseries', name: 'Pâtisseries', products: [product('d')] },
];

function popularity(
  entries: [string, ProductPopularity][]
): Map<string, ProductPopularity> {
  return new Map(entries);
}

describe('attachPopularity', () => {
  it('pose le rang sur les produits suffisamment vendus', () => {
    const result = attachPopularity(
      menu,
      popularity([
        ['a', { orderCount: POPULARITY_MIN_ORDERS + 10, rank: 1 }],
        ['b', { orderCount: POPULARITY_MIN_ORDERS + 5, rank: 2 }],
      ])
    );

    expect(result[0].products[0].popularRank).toBe(1);
    expect(result[0].products[1].popularRank).toBe(2);
    expect(result[0].products[2].popularRank).toBeUndefined();
  });

  it('ignore un rang adossé à trop peu de ventes', () => {
    const result = attachPopularity(
      menu,
      popularity([['a', { orderCount: POPULARITY_MIN_ORDERS - 1, rank: 1 }]])
    );

    expect(result[0].products[0].popularRank).toBeUndefined();
  });

  it('ne marque que les premiers du classement', () => {
    const result = attachPopularity(
      menu,
      popularity([
        [
          'a',
          {
            orderCount: POPULARITY_MIN_ORDERS + 1,
            rank: POPULARITY_RANKED_COUNT,
          },
        ],
        [
          'b',
          {
            orderCount: POPULARITY_MIN_ORDERS + 1,
            rank: POPULARITY_RANKED_COUNT + 1,
          },
        ],
      ])
    );

    expect(result[0].products[0].popularRank).toBe(POPULARITY_RANKED_COUNT);
    expect(result[0].products[1].popularRank).toBeUndefined();
  });

  it('ne publie jamais le volume de ventes', () => {
    const result = attachPopularity(
      menu,
      popularity([['a', { orderCount: 1234, rank: 1 }]])
    );

    expect(JSON.stringify(result)).not.toContain('1234');
    expect(result[0].products[0]).not.toHaveProperty('orderCount');
  });

  it('rend le menu intact quand aucune vente n’est connue', () => {
    expect(attachPopularity(menu, popularity([]))).toEqual(menu);
  });

  it('conserve toutes les catégories et tous les produits', () => {
    const result = attachPopularity(
      menu,
      popularity([['d', { orderCount: POPULARITY_MIN_ORDERS, rank: 1 }]])
    );

    expect(result).toHaveLength(2);
    expect(result[0].products).toHaveLength(3);
    expect(result[1].products[0].popularRank).toBe(1);
  });
});
