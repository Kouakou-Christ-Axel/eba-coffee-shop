// lib/cart-store.test.ts
//
// Actions de résolution d'une rupture (`replaceItem`, `patchItems`). Le store
// est testé sans DOM : la persistance localStorage est inerte en Node.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCartStore, type CartItemDraft } from './cart-store';

function draft(productId: string, overrides: Partial<CartItemDraft> = {}) {
  return {
    productId,
    productName: productId,
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    supplements: [],
    ...overrides,
  } satisfies CartItemDraft;
}

function seed() {
  const { addItem } = useCartStore.getState();
  addItem(draft('a'));
  addItem(draft('b'));
  addItem(draft('b'));
  addItem(draft('c'));
  return useCartStore.getState().items;
}

describe('cart-store — résolution de rupture', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    useCartStore.setState({ items: [], updatedAt: null });
  });

  it('replaceItem remplace la ligne à la même position', () => {
    const [, b] = seed();
    useCartStore.getState().replaceItem(b.cartId, draft('x'), 2);

    const items = useCartStore.getState().items;
    expect(items.map((i) => [i.productId, i.quantity])).toEqual([
      ['a', 1],
      ['x', 2],
      ['c', 1],
    ]);
  });

  it('replaceItem fusionne dans une ligne identique existante', () => {
    const [, b] = seed();
    useCartStore.getState().replaceItem(b.cartId, draft('c'), 2);

    const items = useCartStore.getState().items;
    expect(items.map((i) => [i.productId, i.quantity])).toEqual([
      ['a', 1],
      ['c', 3],
    ]);
  });

  it('replaceItem plafonne sur le stock et ignore un plafond nul', () => {
    const [, b] = seed();
    useCartStore.getState().replaceItem(b.cartId, draft('x'), 5, 3);
    expect(useCartStore.getState().items[1].quantity).toBe(3);

    const before = useCartStore.getState().items;
    useCartStore.getState().replaceItem(before[0].cartId, draft('y'), 1, 0);
    expect(useCartStore.getState().items).toBe(before);
  });

  it('patchItems ne touche que les lignes visées', () => {
    const [a, , c] = seed();
    useCartStore.getState().patchItems({ [a.cartId]: { soldOutToday: true } });

    const items = useCartStore.getState().items;
    expect(items.find((i) => i.cartId === a.cartId)?.soldOutToday).toBe(true);
    expect(items.find((i) => i.cartId === c.cartId)?.soldOutToday).toBe(
      undefined
    );
  });
});
