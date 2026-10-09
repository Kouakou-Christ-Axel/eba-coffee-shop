// Le serveur ne croit rien du panier client : prix, suppléments, remise et total sont revérifiés contre le menu en base.

import { describe, expect, it } from 'vitest';
import { CartMismatchError, assertCartMatchesMenu } from './cart-verification';
import { menu, item } from './cart-verification.test-utils';

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
});
