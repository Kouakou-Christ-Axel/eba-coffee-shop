import { describe, it, expect } from 'vitest';
import {
  expenseItemInputSchema,
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
} from '@/config/constants';

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
