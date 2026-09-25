// lib/orders/availability-core.test.ts
import { describe, expect, it } from 'vitest';
import type { MenuCategory } from '@/config/menu';
import { optionKey, stockSnapshotFromMenu } from './availability-core';

describe('stockSnapshotFromMenu', () => {
  it('reprend le stock des produits et de leurs options, groupes globaux compris', () => {
    const menu: MenuCategory[] = [
      {
        id: 'gateaux',
        name: 'Gâteaux',
        products: [
          {
            id: 'sponge',
            name: 'Sponge',
            description: '',
            price: 2000,
            stockQuantity: 4,
            supplements: [
              {
                name: 'Goût',
                type: 'single',
                required: true,
                options: [
                  { name: 'Vanille', price: 0, stockQuantity: 0 },
                  { name: 'Chocolat', price: 0 },
                ],
              },
              {
                name: 'Extras',
                type: 'multiple',
                required: false,
                isGlobal: true,
                options: [{ name: 'Chantilly', price: 300, stockQuantity: 2 }],
              },
            ],
          },
          { id: 'cookie', name: 'Cookie', description: '', price: 1000 },
        ],
      },
    ];

    const snapshot = stockSnapshotFromMenu(menu);

    expect(snapshot.products.get('sponge')).toBe(4);
    expect(snapshot.products.get('cookie')).toBeNull();
    expect(snapshot.options.get(optionKey('sponge', 'Goût', 'Vanille'))).toBe(
      0
    );
    expect(
      snapshot.options.get(optionKey('sponge', 'Goût', 'Chocolat'))
    ).toBeNull();
    expect(
      snapshot.options.get(optionKey('sponge', 'Extras', 'Chantilly'))
    ).toBe(2);
  });
});
