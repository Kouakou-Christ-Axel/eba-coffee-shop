import { describe, it, expect } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import {
  preorderConflictMessage,
  sameDayOnlyItems,
  sameDayOnlyMessage,
} from './cart-preorder';

function line(over: Partial<CartItem> = {}): CartItem {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Croissant',
    basePrice: 500,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    supplements: [],
    ...over,
  };
}

describe('sameDayOnlyItems', () => {
  it('ne retient que les lignes qui refusent la précommande', () => {
    const items = [
      line({ cartId: 'a' }),
      line({ cartId: 'b', preorderable: false }),
    ];
    expect(sameDayOnlyItems(items).map((i) => i.cartId)).toEqual(['b']);
  });

  it('un délai à l’avance neutralise le refus', () => {
    expect(
      sameDayOnlyItems([line({ preorderable: false, advanceOrderDays: 2 })])
    ).toEqual([]);
  });
});

describe('preorderConflictMessage', () => {
  it('null quand le panier est cohérent', () => {
    expect(preorderConflictMessage([line({ preorderable: false })])).toBeNull();
    expect(preorderConflictMessage([line({ soldOutToday: true })])).toBeNull();
  });

  it('signale un article du jour mêlé à un article pour un autre jour', () => {
    const msg = preorderConflictMessage([
      line({ cartId: 'a', productName: 'Café', preorderable: false }),
      line({ cartId: 'b', productName: 'Gâteau', soldOutToday: true }),
    ]);
    expect(msg).toContain('Café');
    expect(msg).toContain('Gâteau');
  });
});

describe('sameDayOnlyMessage', () => {
  it('nomme les produits sans doublon', () => {
    const items = [
      line({ cartId: 'a', productName: 'Café', preorderable: false }),
      line({ cartId: 'b', productName: 'Café', preorderable: false }),
    ];
    expect(sameDayOnlyMessage(items).match(/Café/g)).toHaveLength(1);
  });
});
