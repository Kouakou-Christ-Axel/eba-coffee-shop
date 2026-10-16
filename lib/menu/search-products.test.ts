import { describe, expect, it } from 'vitest';
import { searchProducts, SEARCH_PRODUCTS_LIMIT } from './search-products';
import type { AdminMenuCategory, AdminMenuProduct } from './queries/admin';

const product = (
  id: string,
  name: string,
  extra: Partial<AdminMenuProduct> = {}
) =>
  ({
    id,
    name,
    price: 1000,
    available: true,
    featured: false,
    stockQuantity: null,
    unavailableUntil: null,
    supplements: [{ name: 'gros groupe global' }],
    ...extra,
  }) as unknown as AdminMenuProduct;

const category = (id: string, name: string, products: AdminMenuProduct[]) =>
  ({ id, name, products }) as unknown as AdminMenuCategory;

const menu = [
  category('c1', 'Pâtisseries', [
    product('p1', 'Chou à la crème'),
    product('p2', 'Éclair au chocolat', { available: false }),
  ]),
  category('c2', 'Boissons', [
    product('p3', 'Chocolat chaud', {
      unavailableUntil: new Date('2026-10-16T10:00:00Z'),
    }),
  ]),
];

describe('searchProducts', () => {
  it('trouve sans tenir compte des accents ni de l’ordre des mots', () => {
    expect(
      searchProducts(menu, { query: 'eclair chocolat' }).products.map(
        (p) => p.id
      )
    ).toEqual(['p2']);
    expect(
      searchProducts(menu, { query: 'creme chou' }).products.map((p) => p.id)
    ).toEqual(['p1']);
  });

  it('renvoie des lignes compactes (état, pause, catégorie), sans suppléments', () => {
    const [row] = searchProducts(menu, { query: 'chocolat chaud' }).products;
    expect(row).toMatchObject({
      id: 'p3',
      category: 'Boissons',
      available: true,
      pausedUntil: '2026-10-16T10:00:00.000Z',
    });
    expect(row).not.toHaveProperty('supplements');
  });

  it('filtre par catégorie ; sans requête, liste tout', () => {
    expect(searchProducts(menu, { categoryId: 'c1' }).total).toBe(2);
    expect(searchProducts(menu, {}).total).toBe(3);
  });

  it('plafonne et signale le total', () => {
    const big = [
      category(
        'c',
        'Tout',
        Array.from({ length: 40 }, (_, i) => product(`p${i}`, `Gâteau ${i}`))
      ),
    ];
    const res = searchProducts(big, {});
    expect(res.products).toHaveLength(SEARCH_PRODUCTS_LIMIT);
    expect(res).toMatchObject({ total: 40, returned: SEARCH_PRODUCTS_LIMIT });
  });
});
