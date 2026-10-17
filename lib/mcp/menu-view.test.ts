// lib/mcp/menu-view.test.ts
import { describe, it, expect } from 'vitest';
import { buildMenuView } from './menu-view';
import type { AdminMenuCategory } from '@/lib/menu/queries/admin';

const product = (id: string, name: string) =>
  ({
    id,
    name,
    description: 'long texte',
    price: 1500,
    available: true,
    stockQuantity: null,
    coutMatiere: 400,
    supplements: [{ name: 'Goûts', options: [] }],
  }) as never;

const menu = [
  {
    id: 'c1',
    name: 'Cafés',
    slug: 'cafes',
    available: true,
    products: [product('p1', 'Café latte'), product('p2', 'Espresso')],
  },
  {
    id: 'c2',
    name: 'Pâtisseries',
    slug: 'patisseries',
    available: true,
    products: [product('p3', 'Chou à la crème')],
  },
  { id: 'c3', name: 'Vide', slug: 'vide', available: true, products: [] },
] as unknown as AdminMenuCategory[];

describe('buildMenuView', () => {
  it('compact par défaut : id, nom, prix, dispo, stock seulement', () => {
    const view = buildMenuView(menu, {});
    expect(view).toHaveLength(3);
    expect(view[0].products[0]).toEqual({
      id: 'p1',
      name: 'Café latte',
      price: 1500,
      available: true,
      stockQuantity: null,
    });
    expect(view[0]).not.toHaveProperty('slug');
  });

  it('full garde la forme complète', () => {
    const view = buildMenuView(menu, { detail: 'full' });
    expect(view[0].products[0]).toHaveProperty('supplements');
  });

  it('productId renvoie un seul produit en détail complet', () => {
    const view = buildMenuView(menu, { productId: 'p3' });
    expect(view).toHaveLength(1);
    expect(view[0].products).toHaveLength(1);
    expect(view[0].products[0]).toHaveProperty('supplements');
  });

  it('categoryId limite à une catégorie', () => {
    const view = buildMenuView(menu, { categoryId: 'c2' });
    expect(view.map((c) => c.id)).toEqual(['c2']);
  });

  it('search est insensible aux accents', () => {
    const view = buildMenuView(menu, { search: 'cafe' });
    expect(view[0].products.map((p) => p.id)).toContain('p1');
    expect(view.some((c) => c.id === 'c2')).toBe(false);
  });
});
