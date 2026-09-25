// lib/cart-availability.test.ts
import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import type { MenuCategory, Product } from '@/config/menu';
import { cartLineStatusLabel, checkCartAgainstMenu } from './cart-availability';

const NOW = new Date('2026-09-25T10:00:00.000Z');

function product(id: string, overrides: Partial<Product> = {}): Product {
  const stock = overrides.stockQuantity;
  return {
    id,
    name: id,
    description: '',
    price: 1000,
    ...(stock !== undefined ? { remaining: stock, soldOut: stock === 0 } : {}),
    ...overrides,
  };
}

function line(productId: string, overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartId: `c-${productId}`,
    productId,
    productName: productId,
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...overrides,
  };
}

const menu: MenuCategory[] = [
  {
    id: 'cat',
    name: 'Cat',
    products: [
      product('ok'),
      product('low', { stockQuantity: 2 }),
      product('empty', { stockQuantity: 0 }),
      product('short', { stockQuantity: 1 }),
      product('paused', { unavailableUntil: '2099-01-01T00:00:00.000Z' }),
      product('sponge', {
        stockQuantity: 5,
        supplements: [
          {
            name: 'Goût',
            type: 'single',
            required: true,
            options: [{ name: 'Vanille', price: 0, stockQuantity: 0 }],
          },
        ],
      }),
    ],
  },
];

describe('checkCartAgainstMenu', () => {
  it('classe chaque ligne et liste celles à résoudre au format du 409', () => {
    const items = [
      line('ok'),
      line('low'),
      line('empty'),
      line('short', { quantity: 3 }),
      line('sponge', {
        supplements: [{ groupName: 'Goût', optionName: 'Vanille', price: 0 }],
      }),
    ];

    const r = checkCartAgainstMenu(items, menu, NOW);

    expect(r.status['c-ok']).toEqual({ kind: 'ok' });
    expect(r.status['c-low']).toEqual({ kind: 'low', remaining: 2 });
    expect(r.status['c-empty']).toEqual({ kind: 'soldOut', remaining: 0 });
    expect(r.status['c-short']).toEqual({ kind: 'soldOut', remaining: 1 });
    expect(r.status['c-sponge']).toEqual({
      kind: 'optionSoldOut',
      names: ['Vanille'],
    });
    expect(r.soldOutLines.map((l) => l.cartId)).toEqual([
      'c-empty',
      'c-short',
      'c-sponge',
    ]);
    expect(r.goneCartIds).toEqual([]);
    expect(r.patches).toEqual({});
  });

  it('marque « plus disponible » un produit en pause ou retiré de la carte', () => {
    const r = checkCartAgainstMenu(
      [line('paused'), line('supprime')],
      menu,
      NOW
    );
    expect(r.goneCartIds).toEqual(['c-paused', 'c-supprime']);
    expect(r.soldOutLines).toEqual([]);
  });

  it('laisse tranquille une ligne déjà prévue pour demain', () => {
    const r = checkCartAgainstMenu(
      [line('empty', { soldOutToday: true })],
      menu,
      NOW
    );
    expect(r.status['c-empty']).toEqual({ kind: 'deferred' });
    expect(r.soldOutLines).toEqual([]);
    expect(r.patches).toEqual({});
  });

  it('lève la contrainte « demain » quand l’article revient en stock', () => {
    const r = checkCartAgainstMenu(
      [line('ok', { soldOutToday: true })],
      menu,
      NOW
    );
    expect(r.patches).toEqual({ 'c-ok': { soldOutToday: undefined } });
    expect(r.status['c-ok']).toEqual({ kind: 'ok' });
  });
});

describe('cartLineStatusLabel', () => {
  it('n’affiche rien pour une ligne sans problème', () => {
    expect(cartLineStatusLabel({ kind: 'ok' })).toBeNull();
    expect(cartLineStatusLabel(undefined)).toBeNull();
  });

  it('distingue « épuisé » et « il n’en reste que N »', () => {
    expect(cartLineStatusLabel({ kind: 'soldOut', remaining: 0 })?.label).toBe(
      'Épuisé aujourd’hui'
    );
    expect(cartLineStatusLabel({ kind: 'soldOut', remaining: 2 })?.label).toBe(
      'Il n’en reste que 2'
    );
  });
});
