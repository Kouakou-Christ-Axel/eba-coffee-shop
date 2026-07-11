// lib/schemas/expense.test.ts
import { describe, it, expect } from 'vitest';
import {
  expenseInputSchema,
  expenseUpdateSchema,
  expenseCategoryInputSchema,
  expenseItemInputSchema,
  resolveExpenseItemAmount,
} from '@/lib/schemas/expense';

describe('expenseInputSchema', () => {
  it('accepte une dépense valide (paymentMethod optionnel)', () => {
    const parsed = expenseInputSchema.parse({
      date: '2026-06-08',
      amount: 1500,
      categoryId: 'cat_1',
    });
    expect(parsed.paymentMethod).toBeUndefined();
    expect(parsed.amount).toBe(1500);
  });

  it('rejette un montant nul/négatif ou non entier', () => {
    const base = { date: '2026-06-08', categoryId: 'c' };
    expect(expenseInputSchema.safeParse({ ...base, amount: 0 }).success).toBe(
      false
    );
    expect(expenseInputSchema.safeParse({ ...base, amount: -5 }).success).toBe(
      false
    );
    expect(expenseInputSchema.safeParse({ ...base, amount: 1.5 }).success).toBe(
      false
    );
  });

  it('rejette une date mal formatée', () => {
    expect(
      expenseInputSchema.safeParse({
        date: '08/06/2026',
        amount: 100,
        categoryId: 'c',
      }).success
    ).toBe(false);
  });

  it('accepte un chemin de justificatif relatif', () => {
    const parsed = expenseInputSchema.parse({
      date: '2026-06-08',
      amount: 100,
      categoryId: 'c',
      receiptUrl: '/uploads/receipts/abc.jpg',
    });
    expect(parsed.receiptUrl).toBe('/uploads/receipts/abc.jpg');
  });
});

describe('expenseInputSchema — lignes de détail (items)', () => {
  const base = { date: '2026-07-10', categoryId: 'c' };

  it('exige amount OU items (dépense sans montant ni détail refusée)', () => {
    expect(expenseInputSchema.safeParse(base).success).toBe(false);
  });

  it('accepte des items sans amount global (dérivé de la somme)', () => {
    const parsed = expenseInputSchema.parse({
      ...base,
      items: [
        { articleName: 'Farine T45', quantity: 2, unitPrice: 5000 },
        { articleName: 'Sucre', amount: 3000 },
      ],
    });
    expect(parsed.amount).toBeUndefined();
    expect(parsed.items).toHaveLength(2);
  });

  it('refuse un amount global différent de la somme des lignes', () => {
    const r = expenseInputSchema.safeParse({
      ...base,
      amount: 12000,
      items: [{ articleName: 'Farine T45', amount: 13000 }],
    });
    expect(r.success).toBe(false);
  });

  it('accepte un amount global égal à la somme (lignes dérivées comprises)', () => {
    const r = expenseInputSchema.safeParse({
      ...base,
      amount: 13000,
      items: [
        { articleName: 'Farine T45', quantity: 2, unitPrice: 5000 }, // 10 000
        { articleName: 'Sucre', amount: 3000 },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe('expenseItemInputSchema', () => {
  it('exige articleId XOR articleName', () => {
    expect(expenseItemInputSchema.safeParse({ amount: 100 }).success).toBe(
      false
    );
    expect(
      expenseItemInputSchema.safeParse({
        articleId: 'a',
        articleName: 'Farine',
        amount: 100,
      }).success
    ).toBe(false);
    expect(
      expenseItemInputSchema.safeParse({ articleName: 'Farine', amount: 100 })
        .success
    ).toBe(true);
  });

  it('exige amount, ou quantity + unitPrice', () => {
    expect(
      expenseItemInputSchema.safeParse({ articleName: 'Farine', quantity: 2 })
        .success
    ).toBe(false);
    expect(
      expenseItemInputSchema.safeParse({
        articleName: 'Farine',
        quantity: 2,
        unitPrice: 5000,
      }).success
    ).toBe(true);
  });

  it('tolère 1 F d’arrondi entre amount et quantity × unitPrice', () => {
    const line = { articleName: 'Café', quantity: 1.5, unitPrice: 333 }; // 499.5
    expect(
      expenseItemInputSchema.safeParse({ ...line, amount: 500 }).success
    ).toBe(true);
    expect(
      expenseItemInputSchema.safeParse({ ...line, amount: 600 }).success
    ).toBe(false);
  });

  it('resolveExpenseItemAmount dérive le montant manquant', () => {
    expect(resolveExpenseItemAmount({ amount: 750 })).toBe(750);
    expect(resolveExpenseItemAmount({ quantity: 2, unitPrice: 5000 })).toBe(
      10000
    );
    expect(resolveExpenseItemAmount({ quantity: 1.5, unitPrice: 333 })).toBe(
      500
    );
  });
});

describe('expenseUpdateSchema', () => {
  it('exige au moins un champ', () => {
    expect(expenseUpdateSchema.safeParse({}).success).toBe(false);
    expect(expenseUpdateSchema.safeParse({ amount: 200 }).success).toBe(true);
  });

  it('accepte items: null (dé-itemisation) et items en replace-all', () => {
    expect(expenseUpdateSchema.safeParse({ items: null }).success).toBe(true);
    expect(
      expenseUpdateSchema.safeParse({
        items: [{ articleName: 'Farine T45', amount: 5000 }],
      }).success
    ).toBe(true);
    // Somme incohérente avec l'amount fourni → refus.
    expect(
      expenseUpdateSchema.safeParse({
        amount: 9000,
        items: [{ articleName: 'Farine T45', amount: 5000 }],
      }).success
    ).toBe(false);
  });
});

describe('expenseCategoryInputSchema', () => {
  it('trim et exige un nom non vide', () => {
    expect(expenseCategoryInputSchema.parse({ name: '  Loyer ' }).name).toBe(
      'Loyer'
    );
    expect(expenseCategoryInputSchema.safeParse({ name: '   ' }).success).toBe(
      false
    );
  });

  it('accepte la nature FIXED/VARIABLE (optionnelle)', () => {
    expect(
      expenseCategoryInputSchema.parse({ name: 'Loyer', nature: 'FIXED' })
        .nature
    ).toBe('FIXED');
    expect(
      expenseCategoryInputSchema.safeParse({ name: 'X', nature: 'AUTRE' })
        .success
    ).toBe(false);
  });
});
