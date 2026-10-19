import { describe, expect, it } from 'vitest';
import type { CartItem } from '@/lib/cart-store';
import {
  buildRefundableLines,
  selectionToLines,
  selectionTotal,
} from './refundable-lines';

const items = [
  {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Café',
    quantity: 2,
    basePrice: 500,
    supplements: [
      { groupName: 'Lait', optionName: 'Avoine', price: 100 },
      { groupName: 'Sirop', optionName: 'Vanille', price: 50, quantity: 2 },
    ],
  },
] as unknown as CartItem[];

describe('buildRefundableLines', () => {
  it('sépare le produit et chaque supplément, avec leur quantité maximale', () => {
    const lines = buildRefundableLines(items);
    expect(lines.map((l) => [l.kind, l.maxQuantity, l.unitAmount])).toEqual([
      ['PRODUCT', 2, 500],
      ['SUPPLEMENT', 2, 100],
      // 2 doses par café × 2 cafés
      ['SUPPLEMENT', 4, 50],
    ]);
    expect(lines[1]).toMatchObject({ groupName: 'Lait', optionName: 'Avoine' });
  });
});

describe('selectionTotal / selectionToLines', () => {
  const lines = buildRefundableLines(items);
  const [product, avoine, vanille] = lines;

  it('somme quantité × valeur', () => {
    expect(
      selectionTotal(lines, {
        [product.key]: 1,
        [avoine.key]: 2,
        [vanille.key]: 3,
      })
    ).toBe(500 + 200 + 150);
  });

  it('ne garde que les lignes cochées, montants pleins si le total suffit', () => {
    const out = selectionToLines(
      lines,
      { [product.key]: 1, [avoine.key]: 1 },
      600
    );
    expect(out).toHaveLength(2);
    expect(out.map((l) => l.amount)).toEqual([500, 100]);
    expect(out[1]).toMatchObject({ kind: 'SUPPLEMENT', groupName: 'Lait' });
  });

  it('réduit au prorata quand le montant est inférieur aux lignes, sans dépasser', () => {
    const out = selectionToLines(
      lines,
      { [product.key]: 2, [avoine.key]: 2 },
      600
    );
    const sum = out.reduce((s, l) => s + l.amount, 0);
    expect(sum).toBe(600);
    expect(out[0].amount).toBeLessThan(1000);
  });

  it('plafonne la quantité à ce que la commande contient', () => {
    const out = selectionToLines(lines, { [product.key]: 9 }, 5000);
    expect(out[0].quantity).toBe(2);
  });

  it('aucune ligne cochée : aucun résultat', () => {
    expect(selectionToLines(lines, {}, 500)).toEqual([]);
  });
});
