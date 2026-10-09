import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import type { CartItem, CartItemSupplement } from '@/lib/cart-store';
import {
  addItem,
  removeItem,
  setItemDiscount,
  setItemQuantity,
  supplementsKey,
} from './cart';

const crepe = {
  id: 'p1',
  name: 'Crêpe',
  description: '',
  price: 1500,
} as Product;

const vanille: CartItemSupplement = {
  groupName: 'Goûts',
  optionName: 'Vanille',
  price: 0,
};
const choco: CartItemSupplement = {
  groupName: 'Goûts',
  optionName: 'Chocolat',
  price: 200,
};

describe('addItem', () => {
  it('crée une ligne de quantité 1 avec coûts à 0 par défaut', () => {
    const [item] = addItem([], crepe, [vanille]);
    expect(item).toMatchObject({
      productId: 'p1',
      productName: 'Crêpe',
      basePrice: 1500,
      coutMatiere: 0,
      coutEmballage: 0,
      quantity: 1,
      supplements: [vanille],
    });
    expect(item.cartId).toBeTruthy();
  });

  it('fusionne même produit + mêmes suppléments, quel que soit leur ordre', () => {
    const first = addItem([], crepe, [vanille, choco]);
    const merged = addItem(first, crepe, [choco, vanille]);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
  });

  it('crée une nouvelle ligne si les suppléments diffèrent', () => {
    const first = addItem([], crepe, [vanille]);
    const next = addItem(first, crepe, [choco]);
    expect(next).toHaveLength(2);
  });
});

describe('supplementsKey', () => {
  it('traite une quantité absente comme 1', () => {
    expect(supplementsKey([vanille])).toBe(
      supplementsKey([{ ...vanille, quantity: 1 }])
    );
  });
});

describe('édition des lignes', () => {
  const lines = [
    { cartId: 'a', quantity: 2 },
    { cartId: 'b', quantity: 1 },
  ] as CartItem[];

  it('retire la ligne quand la quantité est <= 0', () => {
    expect(setItemQuantity(lines, 'a', 0).map((i) => i.cartId)).toEqual(['b']);
  });

  it('met à jour la quantité sans toucher aux autres lignes', () => {
    const next = setItemQuantity(lines, 'a', 5);
    expect(next[0].quantity).toBe(5);
    expect(next[1]).toBe(lines[1]);
  });

  it('retire une ligne', () => {
    expect(removeItem(lines, 'b').map((i) => i.cartId)).toEqual(['a']);
  });

  it('pose la remise et son motif sur la bonne ligne', () => {
    const next = setItemDiscount(lines, 'b', 300, 'Fidélité');
    expect(next[1]).toMatchObject({
      discount: 300,
      discountReason: 'Fidélité',
    });
    expect(next[0]).toBe(lines[0]);
  });
});
