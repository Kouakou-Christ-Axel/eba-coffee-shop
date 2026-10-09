import { describe, it, expect } from 'vitest';
import type { Product } from '@/config/menu';
import {
  canSubmitSelections,
  getSelectedSupplements,
  groupSelectionCount,
  isGroupValid,
  type Selections,
} from '../supplements';

describe('SupplementRules.ignoreSoldOut — commande pour un jour ultérieur', () => {
  const soldOutFlavour: Product = {
    id: 'sponge',
    name: 'Sponge cake',
    description: '',
    price: 2500,
    supplements: [
      {
        name: 'Goûts',
        type: 'single',
        required: true,
        options: [
          { name: 'Vanille', price: 0, remaining: 0, soldOut: true },
          { name: 'Coco', price: 0, remaining: 5 },
        ],
      },
    ],
  };

  it('conserve le goût épuisé dans la ligne du panier', () => {
    expect(
      getSelectedSupplements(soldOutFlavour, { Goûts: 'Vanille' })
    ).toEqual([]);
    expect(
      getSelectedSupplements(
        soldOutFlavour,
        { Goûts: 'Vanille' },
        {
          ignoreSoldOut: true,
        }
      )
    ).toEqual([{ groupName: 'Goûts', optionName: 'Vanille', price: 0 }]);
  });

  it('débloque un groupe requis dont le choix est épuisé', () => {
    expect(canSubmitSelections(soldOutFlavour, { Goûts: 'Vanille' })).toBe(
      false
    );
    expect(
      canSubmitSelections(
        soldOutFlavour,
        { Goûts: 'Vanille' },
        {
          ignoreSoldOut: true,
        }
      )
    ).toBe(true);
  });

  it('compte les parts épuisées dans un groupe « quantity »', () => {
    const boxed: Product = {
      ...soldOutFlavour,
      supplements: [
        {
          name: 'Goûts',
          type: 'quantity',
          required: true,
          minSelect: 3,
          maxSelect: 3,
          options: [
            { name: 'Vanille', price: 0, remaining: 0, soldOut: true },
            { name: 'Coco', price: 0, remaining: 5 },
          ],
        },
      ],
    };
    const selections: Selections = { Goûts: { Vanille: 2, Coco: 1 } };
    expect(groupSelectionCount(boxed.supplements![0], selections)).toBe(1);
    expect(
      groupSelectionCount(boxed.supplements![0], selections, {
        ignoreSoldOut: true,
      })
    ).toBe(3);
    expect(
      getSelectedSupplements(boxed, selections, { ignoreSoldOut: true })
    ).toHaveLength(2);
  });

  it('sans règles, le comportement historique est strictement inchangé', () => {
    expect(
      groupSelectionCount(soldOutFlavour.supplements![0], {
        Goûts: 'Vanille',
      })
    ).toBe(0);
    expect(
      isGroupValid(soldOutFlavour.supplements![0], { Goûts: 'Vanille' })
    ).toBe(false);
  });
});
