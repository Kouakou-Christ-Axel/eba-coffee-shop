import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import { aggregateOrderSupplements } from '@/lib/orders/format';
import type { CartItem } from '@/lib/cart-store';
import { getSelectedSupplements } from './selections';
import { kindStamp, splitSupplementsByKind } from './kind';

// Le cas qui a motivé le champ : un goût « Chocolat » et un supplément
// « Chocolat » sur le même produit.
const chou: Product = {
  id: 'chou',
  name: 'Chou',
  description: '',
  price: 1000,
  supplements: [
    {
      name: 'Goûts',
      kind: 'flavor',
      type: 'single',
      required: true,
      options: [{ name: 'Chocolat', price: 0 }],
    },
    {
      name: 'Sauces',
      kind: 'extra',
      type: 'multiple',
      required: false,
      options: [{ name: 'Chocolat', price: 200 }],
    },
  ],
};

describe('kindStamp', () => {
  it('ne marque que les goûts', () => {
    expect(kindStamp({ kind: 'flavor' })).toEqual({ kind: 'flavor' });
    expect(kindStamp({ kind: 'extra' })).toEqual({});
    expect(kindStamp({})).toEqual({});
  });
});

describe('getSelectedSupplements', () => {
  it('distingue le goût du supplément homonyme', () => {
    const lines = getSelectedSupplements(chou, {
      Goûts: 'Chocolat',
      Sauces: ['Chocolat'],
    });
    expect(lines).toEqual([
      { groupName: 'Goûts', optionName: 'Chocolat', price: 0, kind: 'flavor' },
      { groupName: 'Sauces', optionName: 'Chocolat', price: 200 },
    ]);
  });
});

describe('aggregateOrderSupplements', () => {
  const item = (supplements: CartItem['supplements']): CartItem => ({
    cartId: 'c1',
    productId: 'chou',
    productName: 'Chou',
    basePrice: 1000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 2,
    supplements,
  });

  it('conserve la nature de chaque ligne', () => {
    const [line] = aggregateOrderSupplements([
      item([
        {
          groupName: 'Goûts',
          optionName: 'Chocolat',
          price: 0,
          kind: 'flavor',
        },
        { groupName: 'Sauces', optionName: 'Chocolat', price: 200 },
      ]),
    ]);
    const { flavors, extras } = splitSupplementsByKind(line.supplements);
    expect(flavors).toEqual([
      {
        groupName: 'Goûts',
        optionName: 'Chocolat',
        kind: 'flavor',
        quantity: 2,
      },
    ]);
    expect(extras).toEqual([
      { groupName: 'Sauces', optionName: 'Chocolat', quantity: 2 },
    ]);
  });

  it('ne fusionne pas un goût et un supplément de même nom', () => {
    const lines = aggregateOrderSupplements([
      item([
        {
          groupName: 'Goûts',
          optionName: 'Chocolat',
          price: 0,
          kind: 'flavor',
        },
      ]),
      {
        ...item([{ groupName: 'Goûts', optionName: 'Chocolat', price: 0 }]),
        cartId: 'c2',
      },
    ]);
    expect(lines).toHaveLength(2);
  });
});
