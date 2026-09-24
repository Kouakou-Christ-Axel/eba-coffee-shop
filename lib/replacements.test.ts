// lib/replacements.test.ts
import { describe, expect, it } from 'vitest';
import type { MenuCategory, Product } from '@/config/menu';
import {
  isReplacementCandidate,
  selectReplacementProducts,
} from './replacements';

const NOW = new Date('2026-09-24T10:00:00.000Z');

function product(id: string, overrides: Partial<Product> = {}): Product {
  return { id, name: id, description: '', price: 2000, ...overrides };
}

const menu: MenuCategory[] = [
  {
    id: 'gateaux',
    name: 'Gâteaux',
    products: [
      product('sponge', { soldOut: true, remaining: 0, stockQuantity: 0 }),
      product('brownie', { price: 1500 }),
      product('cookie', { price: 2100 }),
      product('cheesecake', { price: 4000, popularRank: 1 }),
      product('gateau-xl', { advanceOrderDays: 2 }),
      product('gateau-perso', { requiresDeposit: true }),
      product('tarte', { remaining: 1 }),
    ],
  },
  {
    id: 'boissons',
    name: 'Boissons',
    products: [
      product('bissap', { price: 1000, popularRank: 2 }),
      product('jus', { price: 1000, unavailableUntil: '2099-01-01T00:00:00Z' }),
    ],
  },
];

const soldOutLine = { productId: 'sponge', basePrice: 2000, quantity: 2 };

describe('isReplacementCandidate', () => {
  it('écarte épuisé, stock insuffisant, pause, commande à l’avance et acompte', () => {
    const [sponge, brownie, , , xl, perso, tarte] = menu[0].products;
    expect(isReplacementCandidate(sponge, 1, NOW)).toBe(false);
    expect(isReplacementCandidate(brownie, 2, NOW)).toBe(true);
    expect(isReplacementCandidate(xl, 1, NOW)).toBe(false);
    expect(isReplacementCandidate(perso, 1, NOW)).toBe(false);
    expect(isReplacementCandidate(tarte, 1, NOW)).toBe(true);
    expect(isReplacementCandidate(tarte, 2, NOW)).toBe(false);
    expect(isReplacementCandidate(menu[1].products[1], 1, NOW)).toBe(false);
  });
});

describe('selectReplacementProducts', () => {
  it('propose la même catégorie d’abord : rang de vente, puis prix le plus proche', () => {
    const ids = selectReplacementProducts(menu, soldOutLine, { now: NOW }).map(
      (p) => p.id
    );
    expect(ids).toEqual(['cheesecake', 'cookie', 'brownie']);
  });

  it('complète avec le reste de la carte quand la catégorie ne suffit pas', () => {
    const ids = selectReplacementProducts(menu, soldOutLine, {
      excludeProductIds: ['cookie', 'brownie'],
      now: NOW,
    }).map((p) => p.id);
    expect(ids).toEqual(['cheesecake', 'bissap']);
  });

  it('n’inclut jamais le produit épuisé lui-même ni un article déjà au panier', () => {
    const ids = selectReplacementProducts(menu, soldOutLine, {
      excludeProductIds: ['cheesecake'],
      max: 10,
      now: NOW,
    }).map((p) => p.id);
    expect(ids).not.toContain('sponge');
    expect(ids).not.toContain('cheesecake');
  });
});
