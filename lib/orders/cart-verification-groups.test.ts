import { describe, expect, it } from 'vitest';
import { assertCartMatchesMenu } from './cart-verification';
import {
  menu,
  lait,
  parts,
  sirop,
  p3,
  reasonOf,
  item,
} from './cart-verification.test-utils';

describe('assertCartMatchesMenu — règles des groupes de suppléments', () => {
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
      reasonOf(() => assertCartMatchesMenu([p3([lait, parts(3)])], menu, 1000))
    ).toBe('supplement_invalid');
    expect(
      reasonOf(() => assertCartMatchesMenu([p3([lait, parts(5)])], menu, 1000))
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
