// lib/cart-precommande.test.ts
import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import { isPrecommandeCart, precommandeDay } from './cart-precommande';
import { pickupDayString } from '@/lib/orders/scheduling';

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

describe('isPrecommandeCart', () => {
  it('est faux pour un panier vide', () => {
    expect(isPrecommandeCart([])).toBe(false);
  });

  it('est faux quand aucune ligne n’est épuisée aujourd’hui', () => {
    expect(isPrecommandeCart([line('a'), line('b')])).toBe(false);
  });

  it('est vrai dès qu’une ligne est épuisée aujourd’hui', () => {
    expect(
      isPrecommandeCart([line('a'), line('b', { soldOutToday: true })])
    ).toBe(true);
  });

  it('redevient faux une fois la ligne épuisée retirée', () => {
    const withSoldOut = [line('a'), line('b', { soldOutToday: true })];
    const afterRemoval = withSoldOut.filter((i) => i.cartId !== 'c-b');
    expect(isPrecommandeCart(afterRemoval)).toBe(false);
  });

  it('ignore une ligne dont `soldOutToday` est explicitement faux', () => {
    expect(isPrecommandeCart([line('a', { soldOutToday: false })])).toBe(
      false
    );
  });
});

describe('precommandeDay', () => {
  it('est toujours exactement demain (jamais un autre jour)', () => {
    expect(precommandeDay()).toBe(pickupDayString(1));
  });
});
