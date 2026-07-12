// lib/schemas/expense.test.ts
import { describe, it, expect } from 'vitest';
import {
  expenseInputSchema,
  expenseUpdateSchema,
  expenseCategoryInputSchema,
  expenseItemInputSchema,
  expenseNatureSchema,
  resolveExpenseItemAmount,
} from '@/lib/schemas/expense';
import {
  expenseSettingsSchema,
  DEFAULT_EXPENSE_SETTINGS,
} from '@/lib/expense-settings';
import {
  EXPENSE_ITEM_LABEL_MAX,
  EXPENSE_ITEM_UNIT_MAX,
  EXPENSE_ARTICLE_NAME_MAX,
  EXPENSE_ITEMS_MAX,
} from '@/config/constants';

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

describe('expenseNatureSchema', () => {
  it('accepte FIXED et VARIABLE', () => {
    expect(expenseNatureSchema.safeParse('FIXED').success).toBe(true);
    expect(expenseNatureSchema.safeParse('VARIABLE').success).toBe(true);
  });

  it('rejette toute autre valeur', () => {
    expect(expenseNatureSchema.safeParse('AUTRE').success).toBe(false);
    expect(expenseNatureSchema.safeParse('fixed').success).toBe(false);
    expect(expenseNatureSchema.safeParse('').success).toBe(false);
  });
});

describe('expenseItemInputSchema', () => {
  it('rawLabel requis (vide refusé)', () => {
    expect(
      expenseItemInputSchema.safeParse({ rawLabel: 'Farine T45' }).success
    ).toBe(true);
    expect(expenseItemInputSchema.safeParse({ rawLabel: '' }).success).toBe(
      false
    );
    expect(expenseItemInputSchema.safeParse({}).success).toBe(false);
  });

  it('articleId optionnel', () => {
    const r = expenseItemInputSchema.safeParse({ rawLabel: 'Sucre' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.articleId).toBeUndefined();
  });

  it('amount accepte 0 (ligne gratuite) et rejette les négatifs', () => {
    expect(
      expenseItemInputSchema.safeParse({ rawLabel: 'Échantillon', amount: 0 })
        .success
    ).toBe(true);
    expect(
      expenseItemInputSchema.safeParse({ rawLabel: 'Échantillon', amount: -1 })
        .success
    ).toBe(false);
  });

  it('formatQty / formatSize / unitPrice optionnels', () => {
    const r = expenseItemInputSchema.safeParse({ rawLabel: 'Farine T45' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.formatQty).toBeUndefined();
      expect(r.data.formatSize).toBeUndefined();
      expect(r.data.unitPrice).toBeUndefined();
    }
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'Farine T45',
        formatQty: 2,
        formatSize: 25,
        unitPrice: 15000,
      }).success
    ).toBe(true);
  });

  it('rejette un rawLabel trop long', () => {
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'a'.repeat(EXPENSE_ITEM_LABEL_MAX + 1),
      }).success
    ).toBe(false);
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'a'.repeat(EXPENSE_ITEM_LABEL_MAX),
      }).success
    ).toBe(true);
  });

  it('rejette une unit trop longue', () => {
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'Farine',
        unit: 'a'.repeat(EXPENSE_ITEM_UNIT_MAX + 1),
      }).success
    ).toBe(false);
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'Farine',
        unit: 'a'.repeat(EXPENSE_ITEM_UNIT_MAX),
      }).success
    ).toBe(true);
  });

  it('rejette un articleName trop long', () => {
    expect(
      expenseItemInputSchema.safeParse({
        rawLabel: 'Farine',
        articleName: 'a'.repeat(EXPENSE_ARTICLE_NAME_MAX + 1),
      }).success
    ).toBe(false);
  });
});

describe('expenseInputSchema — détail par article (items)', () => {
  const base = { date: '2026-07-10', amount: 13000, categoryId: 'c' };

  it('items absent (dépense globale historique)', () => {
    const r = expenseInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.items).toBeUndefined();
  });

  it('items: null accepté (équivalent à absent)', () => {
    expect(expenseInputSchema.safeParse({ ...base, items: null }).success).toBe(
      true
    );
  });

  it('items: [...] jusqu’à EXPENSE_ITEMS_MAX lignes', () => {
    const items = Array.from({ length: EXPENSE_ITEMS_MAX }, (_, i) => ({
      rawLabel: `Article ${i}`,
      amount: 100,
    }));
    expect(expenseInputSchema.safeParse({ ...base, items }).success).toBe(true);
  });

  it('rejette plus de EXPENSE_ITEMS_MAX lignes', () => {
    const items = Array.from({ length: EXPENSE_ITEMS_MAX + 1 }, (_, i) => ({
      rawLabel: `Article ${i}`,
      amount: 100,
    }));
    expect(expenseInputSchema.safeParse({ ...base, items }).success).toBe(
      false
    );
  });
});

describe('resolveExpenseItemAmount', () => {
  it('un montant explicite est prioritaire', () => {
    expect(
      resolveExpenseItemAmount({
        amount: 750,
        formatQty: 2,
        formatSize: 5,
        unitPrice: 1000,
      })
    ).toBe(750);
  });

  it('amount à 0 est respecté (ligne gratuite), pas dérivé', () => {
    expect(
      resolveExpenseItemAmount({ amount: 0, unitPrice: 5000, formatQty: 2 })
    ).toBe(0);
  });

  it('dérive formatQty × formatSize × unitPrice (arrondi au franc)', () => {
    expect(
      resolveExpenseItemAmount({
        formatQty: 2,
        formatSize: 25,
        unitPrice: 15000,
      })
    ).toBe(750000);
  });

  it('formatSize absent : suppose 1', () => {
    expect(resolveExpenseItemAmount({ formatQty: 3, unitPrice: 500 })).toBe(
      1500
    );
  });

  it('arrondit au franc le plus proche', () => {
    expect(
      resolveExpenseItemAmount({
        formatQty: 1.5,
        formatSize: 1,
        unitPrice: 333,
      })
    ).toBe(500);
  });

  it('null si ni amount ni (unitPrice + formatQty) fournis', () => {
    expect(resolveExpenseItemAmount({})).toBeNull();
    expect(resolveExpenseItemAmount({ unitPrice: 100 })).toBeNull();
    expect(resolveExpenseItemAmount({ formatQty: 2 })).toBeNull();
  });
});

describe('expenseSettingsSchema', () => {
  it('accepte les valeurs par défaut', () => {
    expect(
      expenseSettingsSchema.safeParse(DEFAULT_EXPENSE_SETTINGS).success
    ).toBe(true);
  });

  it('rejette freqWindowDays hors bornes (0 ou > 365)', () => {
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        freqWindowDays: 0,
      }).success
    ).toBe(false);
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        freqWindowDays: 400,
      }).success
    ).toBe(false);
  });

  it('rejette draftTtlMinutes hors bornes (0 ou > 120)', () => {
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        draftTtlMinutes: 0,
      }).success
    ).toBe(false);
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        draftTtlMinutes: 121,
      }).success
    ).toBe(false);
  });

  it('rejette les compteurs minimums non positifs', () => {
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        freqMinCount: 0,
      }).success
    ).toBe(false);
    expect(
      expenseSettingsSchema.safeParse({
        ...DEFAULT_EXPENSE_SETTINGS,
        recurrenceSuggestMinHits: 0,
      }).success
    ).toBe(false);
  });
});
