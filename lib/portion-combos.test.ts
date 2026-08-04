// lib/portion-combos.test.ts
//
// « Les plus prises » : agrégation des répartitions de parts réellement
// choisies, et filtre de disponibilité avant de les proposer.

import { describe, it, expect } from 'vitest';
import type {
  MenuCategory,
  PortionCombo,
  SupplementGroup,
} from '@/config/menu';
import type { CartItemInput } from '@/lib/schemas/order';
import {
  aggregatePortionCombos,
  attachPortionCombos,
  isComboAvailable,
} from '@/lib/portion-combos';
import {
  PORTION_COMBO_MAX,
  PORTION_COMBO_MIN_ORDERS,
} from '@/config/constants';

const GROUP = 'Choisissez vos goûts';

function group(overrides: Partial<SupplementGroup> = {}): SupplementGroup {
  return {
    name: GROUP,
    type: 'quantity',
    required: true,
    minSelect: 3,
    maxSelect: 3,
    options: [
      { name: 'Oreo', price: 0 },
      { name: 'Coco', price: 0 },
      { name: 'Kinder', price: 0 },
    ],
    ...overrides,
  };
}

function menuWith(g: SupplementGroup): MenuCategory[] {
  return [
    {
      id: 'cat',
      name: 'Pâtisseries',
      products: [
        {
          id: 'box',
          name: 'Box x3',
          description: 'Trois parts',
          price: 3000,
          supplements: [g],
        },
      ],
    },
  ];
}

/** Ligne de commande portant une répartition donnée. */
function line(
  counts: Record<string, number>,
  productId = 'box'
): CartItemInput {
  return {
    cartId: 'c',
    productId,
    productName: 'Box x3',
    basePrice: 3000,
    coutMatiere: 0,
    coutEmballage: 0,
    quantity: 1,
    addedLater: false,
    discount: 0,
    supplements: Object.entries(counts).map(([optionName, quantity]) => ({
      groupName: GROUP,
      optionName,
      price: 0,
      quantity,
    })),
  } as CartItemInput;
}

/** `n` lignes identiques. */
function lines(counts: Record<string, number>, n: number): CartItemInput[] {
  return Array.from({ length: n }, () => line(counts));
}

describe('aggregatePortionCombos', () => {
  it('classe les répartitions par fréquence', () => {
    const combos = aggregatePortionCombos(menuWith(group()), [
      ...lines({ Oreo: 2, Coco: 1 }, 5),
      ...lines({ Kinder: 3 }, 3),
    ]);

    const found = combos.get('box');
    expect(found?.map((c) => c.orders)).toEqual([5, 3]);
    expect(found?.[0].counts).toEqual({ Oreo: 2, Coco: 1 });
    expect(found?.[0].groupName).toBe(GROUP);
  });

  it('reconnaît une même répartition saisie dans un autre ordre', () => {
    const combos = aggregatePortionCombos(menuWith(group()), [
      ...lines({ Oreo: 2, Coco: 1 }, 2),
      ...lines({ Coco: 1, Oreo: 2 }, 2),
    ]);

    expect(combos.get('box')).toHaveLength(1);
    expect(combos.get('box')?.[0].orders).toBe(4);
  });

  it('écarte une répartition trop rare', () => {
    const combos = aggregatePortionCombos(
      menuWith(group()),
      lines({ Oreo: 3 }, PORTION_COMBO_MIN_ORDERS - 1)
    );

    expect(combos.size).toBe(0);
  });

  it('ignore les boîtes incomplètes', () => {
    // Historiquement possible : `minSelect` plus bas que la taille de la boîte.
    // Reproposer une telle répartition laisserait des parts vides.
    const combos = aggregatePortionCombos(
      menuWith(group()),
      lines({ Oreo: 1 }, 10)
    );

    expect(combos.size).toBe(0);
  });

  it('compte une décision par ligne, pas par boîte commandée', () => {
    const three = lines({ Oreo: 3 }, PORTION_COMBO_MIN_ORDERS).map((l) => ({
      ...l,
      quantity: 4,
    }));

    expect(
      aggregatePortionCombos(menuWith(group()), three).get('box')?.[0].orders
    ).toBe(PORTION_COMBO_MIN_ORDERS);
  });

  it('borne le nombre de répartitions proposées', () => {
    const many = Array.from({ length: PORTION_COMBO_MAX + 3 }, (_, i) =>
      lines({ Oreo: 3 - (i % 3), Coco: i % 3 }, PORTION_COMBO_MIN_ORDERS + i)
    ).flat();

    expect(
      aggregatePortionCombos(menuWith(group()), many).get('box')?.length
    ).toBeLessThanOrEqual(PORTION_COMBO_MAX);
  });

  it('ignore les produits sans groupe à parts fixes', () => {
    const loose = group({ minSelect: 1, maxSelect: 3 });

    expect(
      aggregatePortionCombos(menuWith(loose), lines({ Oreo: 3 }, 10)).size
    ).toBe(0);
  });

  it('ignore les lignes d’un autre produit', () => {
    const combos = aggregatePortionCombos(
      menuWith(group()),
      lines({ Oreo: 3 }, 10).map((l) => ({ ...l, productId: 'autre' }))
    );

    expect(combos.size).toBe(0);
  });

  it('s’adapte à une boîte d’une autre taille', () => {
    const big = group({ minSelect: 8, maxSelect: 8 });
    const combos = aggregatePortionCombos(
      menuWith(big),
      lines({ Oreo: 5, Coco: 3 }, 4)
    );

    expect(combos.get('box')?.[0].counts).toEqual({ Oreo: 5, Coco: 3 });
  });
});

describe('attachPortionCombos', () => {
  it('pose les répartitions sur le bon produit', () => {
    const menu = menuWith(group());
    const combo: PortionCombo = {
      groupName: GROUP,
      counts: { Oreo: 3 },
      orders: 9,
    };

    const result = attachPortionCombos(menu, new Map([['box', [combo]]]));

    expect(result[0].products[0].portionCombos).toEqual([combo]);
  });

  it('rend le menu intact quand il n’y a rien à proposer', () => {
    const menu = menuWith(group());
    expect(attachPortionCombos(menu, new Map())).toBe(menu);
  });
});

describe('isComboAvailable', () => {
  const combo: PortionCombo = {
    groupName: GROUP,
    counts: { Oreo: 2, Coco: 1 },
    orders: 9,
  };

  it('accepte une répartition entièrement disponible', () => {
    expect(isComboAvailable(combo, group())).toBe(true);
  });

  it('refuse une répartition contenant un goût épuisé', () => {
    const g = group({
      options: [
        { name: 'Oreo', price: 0, soldOut: true },
        { name: 'Coco', price: 0 },
      ],
    });

    expect(isComboAvailable(combo, g)).toBe(false);
  });

  it('refuse une répartition qui dépasse le stock d’un goût', () => {
    const g = group({
      options: [
        { name: 'Oreo', price: 0, remaining: 1 }, // il en faut 2
        { name: 'Coco', price: 0, remaining: 5 },
      ],
    });

    expect(isComboAvailable(combo, g)).toBe(false);
  });

  it('refuse une répartition dont un goût a disparu du menu', () => {
    const g = group({ options: [{ name: 'Coco', price: 0 }] });

    expect(isComboAvailable(combo, g)).toBe(false);
  });

  it('accepte un goût à stock non suivi', () => {
    const g = group({
      options: [
        { name: 'Oreo', price: 0, remaining: null },
        { name: 'Coco', price: 0, remaining: null },
      ],
    });

    expect(isComboAvailable(combo, g)).toBe(true);
  });
});
