// lib/schemas/expense.test.ts
import { describe, it, expect } from 'vitest';
import {
  expenseInputSchema,
  expenseUpdateSchema,
  expenseCategoryInputSchema,
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

describe('expenseUpdateSchema', () => {
  it('exige au moins un champ', () => {
    expect(expenseUpdateSchema.safeParse({}).success).toBe(false);
    expect(expenseUpdateSchema.safeParse({ amount: 200 }).success).toBe(true);
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
});
