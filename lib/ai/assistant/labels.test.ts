import { beforeEach, describe, expect, it, vi } from 'vitest';

const productFindUnique = vi.fn();
const productFindMany = vi.fn();
const categoryFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({
  default: {
    product: {
      findUnique: (a: unknown) => productFindUnique(a),
      findMany: (a: unknown) => productFindMany(a),
    },
    menuCategory: { findUnique: (a: unknown) => categoryFindUnique(a) },
  },
}));

import { pendingLabel } from './labels';

beforeEach(() => {
  productFindUnique.mockReset();
  productFindMany.mockReset();
  categoryFindUnique.mockReset();
});

describe('pendingLabel', () => {
  it('nomme un produit unique avec sa catégorie', async () => {
    productFindUnique.mockResolvedValue({
      name: 'Chou',
      category: { name: 'Pâtisseries' },
    });
    expect(await pendingLabel({ id: 'p1' })).toBe(
      'Produit : Chou (Pâtisseries)'
    );
  });

  it('résume un lot par ids (5 noms max puis +N)', async () => {
    productFindMany.mockResolvedValue(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((name) => ({ name }))
    );
    const ids = ['1', '2', '3', '4', '5', '6', '7'];
    expect(await pendingLabel({ target: { ids }, patch: {} })).toBe(
      '7 produits : A, B, C, D, E, +2'
    );
  });

  it('lit les ids dans items[]', async () => {
    productFindMany.mockResolvedValue([{ name: 'A' }, { name: 'B' }]);
    expect(await pendingLabel({ items: [{ id: '1' }, { id: '2' }] })).toBe(
      '2 produits : A, B'
    );
  });

  it('nomme la catégorie visée par un lot', async () => {
    categoryFindUnique.mockResolvedValue({ name: 'Boissons' });
    expect(
      await pendingLabel({ target: { categoryId: 'c1' }, patch: {} })
    ).toBe('Toute la catégorie : Boissons');
  });

  it('retombe sur undefined en cas d’erreur', async () => {
    productFindMany.mockRejectedValue(new Error('db'));
    expect(await pendingLabel({ target: { ids: ['1'] } })).toBeUndefined();
  });
});
