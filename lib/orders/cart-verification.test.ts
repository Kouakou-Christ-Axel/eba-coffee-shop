// lib/orders/cart-verification.test.ts
//
// Avant le paiement en ligne, le serveur ne doit RIEN croire du panier envoyé par
// le navigateur : prix, suppléments, remise et total. Sans cela, un total falsifié
// à 1 F ferait payer 1 F une commande de 5 000 F, que Jèko encaisserait et que le
// webhook enverrait en cuisine. Le prix de référence est celui du menu en base.

import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import { CartMismatchError, assertCartMatchesMenu } from './cart-verification';

const menu = [
  {
    products: [
      {
        id: 'p1',
        price: 1500,
        supplements: [
          {
            name: 'Taille',
            options: [
              { name: 'Grand', price: 500, available: true },
              { name: 'Petit', price: 0, available: true },
            ],
          },
          {
            // Doublon de nom : option désactivée conservée à côté de l'active.
            name: 'Goût',
            options: [
              { name: 'Vanille', price: 300, available: false },
              { name: 'Vanille', price: 400, available: true },
            ],
          },
        ],
      },
      { id: 'p2', price: 2000, supplements: [] },
      {
        id: 'p3',
        price: 1000,
        supplements: [
          {
            name: 'Lait',
            type: 'single',
            required: true,
            options: [
              { name: 'Vache', price: 0, available: true },
              { name: 'Avoine', price: 200, available: true },
              { name: 'Coco', price: 300, available: false },
            ],
          },
          {
            name: 'Sirop',
            type: 'multiple',
            maxSelect: 2,
            options: [
              { name: 'Caramel', price: 100, available: true },
              { name: 'Noisette', price: 100, available: true },
              { name: 'Menthe', price: 100, available: true },
            ],
          },
          {
            name: 'Parts',
            type: 'quantity',
            minSelect: 4,
            maxSelect: 4,
            options: [
              { name: 'Vanille', price: 0, available: true },
              { name: 'Chocolat', price: 0, available: true },
            ],
          },
        ],
      },
    ],
  },
] as never;

const lait = { groupName: 'Lait', optionName: 'Vache', price: 0 };
const parts = (n: number) => ({
  groupName: 'Parts',
  optionName: 'Vanille',
  price: 0,
  quantity: n,
});
const sirop = (optionName: string) => ({
  groupName: 'Sirop',
  optionName,
  price: 100,
  quantity: 1,
});
const p3 = (supplements: CartItem['supplements']) =>
  item({ productId: 'p3', basePrice: 1000, supplements });
const reasonOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return (err as CartMismatchError).reason;
  }
};

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Café',
    basePrice: 1500,
    quantity: 1,
    supplements: [],
    discount: 0,
    ...overrides,
  } as CartItem;
}

describe('assertCartMatchesMenu', () => {
  it('renvoie le total serveur quand tout correspond au menu', () => {
    const items = [
      item({
        quantity: 2,
        supplements: [
          { groupName: 'Taille', optionName: 'Grand', price: 500, quantity: 1 },
        ],
      }),
      item({ cartId: 'c2', productId: 'p2', basePrice: 2000 }),
    ];
    // (1500 + 500) × 2 + 2000
    expect(assertCartMatchesMenu(items, menu, 6000)).toBe(6000);
  });

  it('refuse un prix de base différent du menu', () => {
    expect(() =>
      assertCartMatchesMenu([item({ basePrice: 1 })], menu, 1)
    ).toThrow(CartMismatchError);
  });

  it('refuse un prix de supplément différent du menu', () => {
    const items = [
      item({
        supplements: [
          { groupName: 'Taille', optionName: 'Grand', price: 0, quantity: 1 },
        ],
      }),
    ];
    expect(() => assertCartMatchesMenu(items, menu, 1500)).toThrow(
      CartMismatchError
    );
  });

  it('compare au prix de l’option DISPONIBLE quand deux options portent le même nom', () => {
    const items = [
      item({
        supplements: [
          { groupName: 'Goût', optionName: 'Vanille', price: 400, quantity: 1 },
        ],
      }),
    ];
    expect(assertCartMatchesMenu(items, menu, 1900)).toBe(1900);
  });

  it('refuse un produit inconnu', () => {
    expect(() =>
      assertCartMatchesMenu([item({ productId: 'fantome' })], menu, 1500)
    ).toThrow(CartMismatchError);
  });

  it('refuse un groupe ou une option de supplément inconnus', () => {
    const unknownGroup = item({
      supplements: [
        { groupName: 'Secret', optionName: 'Grand', price: 0, quantity: 1 },
      ],
    });
    const unknownOption = item({
      supplements: [
        { groupName: 'Taille', optionName: 'Géant', price: 0, quantity: 1 },
      ],
    });
    expect(() => assertCartMatchesMenu([unknownGroup], menu, 1500)).toThrow(
      CartMismatchError
    );
    expect(() => assertCartMatchesMenu([unknownOption], menu, 1500)).toThrow(
      CartMismatchError
    );
  });

  it('refuse toute remise : un client ne se fait pas de remise lui-même', () => {
    expect(() =>
      assertCartMatchesMenu([item({ discount: 100 })], menu, 1400)
    ).toThrow(CartMismatchError);
  });

  it('refuse un total différent de la somme des lignes', () => {
    expect(() => assertCartMatchesMenu([item()], menu, 1)).toThrow(
      CartMismatchError
    );
  });

  it('refuse un panier vide', () => {
    expect(() => assertCartMatchesMenu([], menu, 0)).toThrow(CartMismatchError);
  });

  it('identifie la cause dans `reason`, pour que le client sache quoi faire', () => {
    const reason = (fn: () => unknown) => {
      try {
        fn();
      } catch (err) {
        return (err as CartMismatchError).reason;
      }
    };
    expect(
      reason(() => assertCartMatchesMenu([item({ basePrice: 1 })], menu, 1))
    ).toBe('price_changed');
    expect(
      reason(() =>
        assertCartMatchesMenu([item({ productId: 'fantome' })], menu, 1500)
      )
    ).toBe('product_unknown');
    expect(reason(() => assertCartMatchesMenu([item()], menu, 1))).toBe(
      'total_mismatch'
    );
  });

  describe('règles des groupes de suppléments', () => {
    it('accepte une sélection conforme', () => {
      expect(
        assertCartMatchesMenu(
          [p3([lait, sirop('Caramel'), sirop('Menthe'), parts(4)])],
          menu,
          1200
        )
      ).toBe(1200);
    });

    it('n’exige pas un groupe requis masqué au public', () => {
      const hidden = [
        {
          products: [
            {
              id: 'p4',
              price: 1000,
              supplements: [
                {
                  name: 'Interne',
                  type: 'single',
                  required: true,
                  available: false,
                  options: [{ name: 'A', price: 0, available: true }],
                },
              ],
            },
          ],
        },
      ] as never;
      const it4 = item({ productId: 'p4', basePrice: 1000 });
      expect(assertCartMatchesMenu([it4], hidden, 1000)).toBe(1000);
    });

    it('refuse un groupe requis absent', () => {
      expect(
        reasonOf(() => assertCartMatchesMenu([p3([parts(4)])], menu, 1000))
      ).toBe('supplement_invalid');
    });

    it('refuse plus d’options que maxSelect', () => {
      const sel = [
        lait,
        sirop('Caramel'),
        sirop('Noisette'),
        sirop('Menthe'),
        parts(4),
      ];
      expect(reasonOf(() => assertCartMatchesMenu([p3(sel)], menu, 1300))).toBe(
        'supplement_invalid'
      );
    });

    it('refuse deux choix dans un groupe « single »', () => {
      const sel = [
        lait,
        { groupName: 'Lait', optionName: 'Avoine', price: 200 },
        parts(4),
      ];
      expect(reasonOf(() => assertCartMatchesMenu([p3(sel)], menu, 1200))).toBe(
        'supplement_invalid'
      );
    });

    it('refuse une répartition qui n’égale pas les parts de la boîte', () => {
      expect(
        reasonOf(() =>
          assertCartMatchesMenu([p3([lait, parts(3)])], menu, 1000)
        )
      ).toBe('supplement_invalid');
      expect(
        reasonOf(() =>
          assertCartMatchesMenu([p3([lait, parts(5)])], menu, 1000)
        )
      ).toBe('supplement_invalid');
    });

    it('refuse une option désactivée', () => {
      const sel = [
        { groupName: 'Lait', optionName: 'Coco', price: 300 },
        parts(4),
      ];
      expect(reasonOf(() => assertCartMatchesMenu([p3(sel)], menu, 1300))).toBe(
        'supplement_invalid'
      );
    });

    it('refuse une quantité > 1 sur un groupe qui n’est pas « quantity »', () => {
      const sel = [{ ...lait, quantity: 3 }, parts(4)];
      expect(reasonOf(() => assertCartMatchesMenu([p3(sel)], menu, 1000))).toBe(
        'supplement_invalid'
      );
    });

    it('refuse la même option cochée deux fois dans un groupe « multiple »', () => {
      const sel = [lait, sirop('Caramel'), sirop('Caramel'), parts(4)];
      expect(reasonOf(() => assertCartMatchesMenu([p3(sel)], menu, 1200))).toBe(
        'supplement_invalid'
      );
    });
  });
});
