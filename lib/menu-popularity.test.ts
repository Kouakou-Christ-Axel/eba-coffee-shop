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
  computePopularity,
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

  it('marque aussi les produits au-delà du plafond du badge', () => {
    // Le rang sert à ORDONNER la vitrine autant qu'à badger : le borner ici
    // faisait disparaître la vitrine dès qu'un des trois premiers produits
    // était indisponible. Le plafond d'affichage vit dans `productBadgeLabel`.
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
    expect(result[0].products[1].popularRank).toBe(POPULARITY_RANKED_COUNT + 1);
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

describe('computePopularity', () => {
  function saleLine(productId: string, quantity: number) {
    return { productId, quantity } as never;
  }

  it('classe par quantité vendue décroissante', () => {
    const ranks = computePopularity([
      saleLine('petit', 5),
      saleLine('gros', 50),
      saleLine('moyen', 20),
    ]);

    expect(ranks.get('gros')?.rank).toBe(1);
    expect(ranks.get('moyen')?.rank).toBe(2);
    expect(ranks.get('petit')?.rank).toBe(3);
  });

  it('cumule les lignes d’un même produit', () => {
    const ranks = computePopularity([saleLine('a', 3), saleLine('a', 4)]);

    expect(ranks.get('a')?.orderCount).toBe(7);
  });

  it('n’attribue pas de rang à un produit absent de la carte', () => {
    // Le défaut d'origine : un best-seller désactivé consommait un rang, et le
    // produit visible juste derrière n'en recevait aucun. Constaté en
    // production — le rang 2 tombait sur un produit retiré de la carte.
    const ranks = computePopularity(
      [saleLine('desactive', 100), saleLine('visible', 10)],
      new Set(['visible'])
    );

    expect(ranks.has('desactive')).toBe(false);
    expect(ranks.get('visible')?.rank).toBe(1);
  });

  it('classe sur tout l’historique quand aucune restriction n’est donnée', () => {
    const ranks = computePopularity([
      saleLine('desactive', 100),
      saleLine('visible', 10),
    ]);

    expect(ranks.get('desactive')?.rank).toBe(1);
    expect(ranks.get('visible')?.rank).toBe(2);
  });
});
