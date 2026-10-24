import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import { formatSupplementsSummary } from '@/lib/orders/format';
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

describe('formatSupplementsSummary', () => {
  const flavor = {
    groupName: 'Goûts',
    optionName: 'Chocolat',
    price: 0,
    kind: 'flavor' as const,
  };
  const sauce = { groupName: 'Sauces', optionName: 'Chocolat', price: 200 };

  it('étiquette les deux natures quand la ligne a les deux', () => {
    expect(formatSupplementsSummary([sauce, flavor])).toBe(
      'Goûts : Chocolat · Suppléments : Chocolat'
    );
  });

  it('étiquette un goût seul', () => {
    expect(formatSupplementsSummary([{ ...flavor, quantity: 2 }])).toBe(
      'Goûts : Chocolat ×2'
    );
  });

  it('laisse les suppléments seuls sans étiquette (rendu inchangé)', () => {
    expect(formatSupplementsSummary([sauce])).toBe('Chocolat');
  });

  it('respecte le séparateur d’éléments', () => {
    const vanille = { ...flavor, optionName: 'Vanille' };
    expect(formatSupplementsSummary([flavor, vanille], ' · ')).toBe(
      'Goûts : Chocolat · Vanille'
    );
  });
});
