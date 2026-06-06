import { describe, it, expect } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import {
  computeItemsDiscount,
  computeItemsTotal,
  getItemDiscount,
  getItemGross,
  getItemNet,
  getMaxItemDiscount,
} from './totals';

function item(partial: Partial<CartItem>): CartItem {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Crêpe',
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...partial,
  };
}

describe('totals — calcul des lignes avec remise', () => {
  it('getItemGross inclut suppléments et quantité', () => {
    const it = item({
      basePrice: 1000,
      quantity: 2,
      supplements: [{ groupName: 'Sauce', optionName: 'Nutella', price: 200 }],
    });
    expect(getItemGross(it)).toBe(2400); // (1000 + 200) * 2
  });

  it('getMaxItemDiscount = 50% du brut (arrondi inférieur)', () => {
    expect(getMaxItemDiscount(item({ basePrice: 1000, quantity: 2 }))).toBe(
      1000
    );
    expect(getMaxItemDiscount(item({ basePrice: 999, quantity: 1 }))).toBe(499);
  });

  it('getItemDiscount borne la remise au plafond', () => {
    const it = item({ basePrice: 1000, quantity: 2, discount: 1500 });
    expect(getItemDiscount(it)).toBe(1000); // plafonné à 50%
  });

  it('getItemDiscount accepte une remise valide', () => {
    const it = item({ basePrice: 1000, quantity: 2, discount: 500 });
    expect(getItemDiscount(it)).toBe(500);
    expect(getItemNet(it)).toBe(1500);
  });

  it('getItemNet sans remise = brut', () => {
    expect(getItemNet(item({ basePrice: 1500 }))).toBe(1500);
  });

  it('computeItemsTotal / computeItemsDiscount agrègent les lignes', () => {
    const items = [
      item({ cartId: 'a', basePrice: 1000, quantity: 2, discount: 500 }),
      item({ cartId: 'b', basePrice: 2000, quantity: 1 }),
    ];
    expect(computeItemsTotal(items)).toBe(1500 + 2000);
    expect(computeItemsDiscount(items)).toBe(500);
  });
});
