// lib/supplements.test.ts
import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import {
  buildInitialSelections,
  canSubmitSelections,
  effectiveMax,
  effectiveMin,
  getSelectedSupplements,
  getSupplementsPrice,
  groupConstraintLabel,
  groupSelectionCount,
  isGroupValid,
  optionQuantity,
  type Selections,
} from './supplements';

const spongeCake: Product = {
  id: 'sponge-cake',
  name: 'Sponge Cake (x3)',
  description: '3 parts, 3 goûts au choix',
  price: 6000,
  supplements: [
    {
      name: 'Goûts',
      type: 'quantity',
      required: true,
      minSelect: 3,
      maxSelect: 3,
      options: [
        { name: 'Vanille', price: 0 },
        { name: 'Chocolat', price: 0 },
        { name: 'Fraise', price: 0 },
      ],
    },
  ],
};

const cappuccino: Product = {
  id: 'cappuccino',
  name: 'Cappuccino',
  description: '',
  price: 3500,
  supplements: [
    {
      name: 'Choix du lait',
      type: 'single',
      required: false,
      options: [
        { name: 'Lait classique', price: 0 },
        { name: 'Lait d’avoine', price: 500 },
      ],
    },
    {
      name: 'Extras',
      type: 'multiple',
      required: false,
      maxSelect: 2,
      options: [
        { name: 'Shot espresso', price: 300 },
        { name: 'Sirop vanille', price: 200 },
        { name: 'Chantilly', price: 300 },
      ],
    },
  ],
};

describe('groupe type "quantity" (répartition, ex. sponge cake)', () => {
  it('permet de répartir 2x un goût + 1x un autre pour atteindre le total exact', () => {
    const selections: Selections = {
      Goûts: { Vanille: 2, Chocolat: 1 },
    };
    expect(groupSelectionCount(spongeCake.supplements![0], selections)).toBe(3);
    expect(isGroupValid(spongeCake.supplements![0], selections)).toBe(true);
    expect(canSubmitSelections(spongeCake, selections)).toBe(true);
  });

  it('refuse un total incomplet (min = max = 3)', () => {
    const selections: Selections = { Goûts: { Vanille: 2 } };
    expect(isGroupValid(spongeCake.supplements![0], selections)).toBe(false);
    expect(canSubmitSelections(spongeCake, selections)).toBe(false);
  });

  it('refuse un total qui dépasse le maximum', () => {
    const selections: Selections = {
      Goûts: { Vanille: 2, Chocolat: 1, Fraise: 1 },
    };
    expect(isGroupValid(spongeCake.supplements![0], selections)).toBe(false);
  });

  it('produit une ligne par option choisie avec sa quantité', () => {
    const selections: Selections = { Goûts: { Vanille: 2, Chocolat: 1 } };
    const supplements = getSelectedSupplements(spongeCake, selections);
    expect(supplements).toEqual(
      expect.arrayContaining([
        { groupName: 'Goûts', optionName: 'Vanille', price: 0, quantity: 2 },
        { groupName: 'Goûts', optionName: 'Chocolat', price: 0, quantity: 1 },
      ])
    );
    expect(supplements).toHaveLength(2);
  });

  it('effectiveMin/effectiveMax reflètent minSelect/maxSelect explicites', () => {
    const g = spongeCake.supplements![0];
    expect(effectiveMin(g)).toBe(3);
    expect(effectiveMax(g)).toBe(3);
  });

  it('groupConstraintLabel annonce une répartition exacte', () => {
    expect(groupConstraintLabel(spongeCake.supplements![0])).toBe(
      'Répartissez exactement 3'
    );
  });

  it('optionQuantity renvoie 0 pour une option non choisie', () => {
    const selections: Selections = { Goûts: { Vanille: 2 } };
    expect(
      optionQuantity(spongeCake.supplements![0], selections, 'Fraise')
    ).toBe(0);
  });
});

describe('groupe "multiple" avec maxSelect', () => {
  it('reste valide sans borne minimale (groupe non requis)', () => {
    const selections: Selections = { 'Choix du lait': '', Extras: [] };
    expect(canSubmitSelections(cappuccino, selections)).toBe(true);
  });

  it('refuse plus de maxSelect options cochées', () => {
    const group = cappuccino.supplements![1];
    const selections: Selections = {
      Extras: ['Shot espresso', 'Sirop vanille', 'Chantilly'],
    };
    expect(groupSelectionCount(group, selections)).toBe(3);
    expect(isGroupValid(group, selections)).toBe(false);
  });

  it('accepte jusqu’à maxSelect options', () => {
    const group = cappuccino.supplements![1];
    const selections: Selections = {
      Extras: ['Shot espresso', 'Sirop vanille'],
    };
    expect(isGroupValid(group, selections)).toBe(true);
  });

  it('calcule le prix total en tenant compte des quantités', () => {
    const selections: Selections = {
      'Choix du lait': 'Lait d’avoine',
      Extras: ['Shot espresso'],
    };
    const supplements = getSelectedSupplements(cappuccino, selections);
    expect(getSupplementsPrice(supplements)).toBe(500 + 300);
  });
});

describe('groupe "single" requis (comportement historique inchangé)', () => {
  const required: Product = {
    ...cappuccino,
    supplements: [{ ...cappuccino.supplements![0], required: true }],
  };

  it('invalide tant qu’aucune option n’est choisie', () => {
    expect(canSubmitSelections(required, { 'Choix du lait': '' })).toBe(false);
  });

  it('valide une fois un choix fait', () => {
    expect(
      canSubmitSelections(required, { 'Choix du lait': 'Lait classique' })
    ).toBe(true);
  });
});

describe('options épuisées (soldOut) — ne comptent jamais, jamais soumises', () => {
  const bissapChoux: Product = {
    id: 'chou-x2',
    name: 'Chou x2',
    description: '',
    price: 1500,
    supplements: [
      {
        name: 'Goût',
        type: 'single',
        required: true,
        options: [
          { name: 'Nutella', price: 0, remaining: 4 },
          { name: 'Bissap', price: 0, remaining: 0, soldOut: true },
        ],
      },
    ],
  };

  it('un groupe single requis dont le seul choix viable est épuisé reste bloqué', () => {
    const onlySoldOut: Product = {
      ...bissapChoux,
      supplements: [
        {
          ...bissapChoux.supplements![0],
          options: [{ name: 'Bissap', price: 0, remaining: 0, soldOut: true }],
        },
      ],
    };
    // Même si "sélectionné" (ex. état restauré), l'option épuisée ne valide pas
    // un groupe requis — le message "requis" existant reste affiché.
    expect(canSubmitSelections(onlySoldOut, { Goût: 'Bissap' })).toBe(false);
  });

  it('une sélection sur une option épuisée ne compte pas (groupSelectionCount)', () => {
    const group = bissapChoux.supplements![0];
    expect(groupSelectionCount(group, { Goût: 'Bissap' })).toBe(0);
    expect(groupSelectionCount(group, { Goût: 'Nutella' })).toBe(1);
  });

  it('getSelectedSupplements omet une option épuisée même si sélectionnée', () => {
    expect(getSelectedSupplements(bissapChoux, { Goût: 'Bissap' })).toEqual([]);
    expect(getSelectedSupplements(bissapChoux, { Goût: 'Nutella' })).toEqual([
      { groupName: 'Goût', optionName: 'Nutella', price: 0 },
    ]);
  });

  it('groupe "multiple" : une option épuisée cochée ne compte pas et n’est pas soumise', () => {
    const group: Product = {
      ...cappuccino,
      supplements: [
        {
          name: 'Extras',
          type: 'multiple',
          required: false,
          maxSelect: 2,
          options: [
            { name: 'Shot espresso', price: 300 },
            { name: 'Chantilly', price: 300, remaining: 0, soldOut: true },
          ],
        },
      ],
    };
    const selections: Selections = { Extras: ['Shot espresso', 'Chantilly'] };
    expect(groupSelectionCount(group.supplements![0], selections)).toBe(1);
    expect(getSelectedSupplements(group, selections)).toEqual([
      { groupName: 'Extras', optionName: 'Shot espresso', price: 300 },
    ]);
  });

  it('groupe "quantity" : une option épuisée ne contribue pas au total ni à la soumission', () => {
    const group: Product = {
      ...spongeCake,
      supplements: [
        {
          ...spongeCake.supplements![0],
          options: [
            { name: 'Vanille', price: 0 },
            { name: 'Chocolat', price: 0 },
            { name: 'Fraise', price: 0, remaining: 0, soldOut: true },
          ],
        },
      ],
    };
    const selections: Selections = {
      Goûts: { Vanille: 2, Fraise: 1 },
    };
    // Total effectif = 2 (Fraise épuisée ignorée) < minSelect/maxSelect (3).
    expect(groupSelectionCount(group.supplements![0], selections)).toBe(2);
    expect(canSubmitSelections(group, selections)).toBe(false);
    expect(getSelectedSupplements(group, selections)).toEqual([
      { groupName: 'Goûts', optionName: 'Vanille', price: 0, quantity: 2 },
    ]);
  });
});

describe('buildInitialSelections', () => {
  it('reconstruit une répartition de quantités depuis des suppléments existants', () => {
    const selections = buildInitialSelections(spongeCake, [
      { groupName: 'Goûts', optionName: 'Vanille', price: 0, quantity: 2 },
      { groupName: 'Goûts', optionName: 'Chocolat', price: 0, quantity: 1 },
    ]);
    expect(selections['Goûts']).toEqual({ Vanille: 2, Chocolat: 1 });
  });
});
