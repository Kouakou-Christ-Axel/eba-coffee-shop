// lib/schemas/purchase.test.ts
import { describe, it, expect } from 'vitest';
import {
  purchaseLineInputSchema,
  preparePurchaseSchema,
  purchaseLineResolutionSchema,
  confirmPurchaseSchema,
  prepareOtherExpenseSchema,
  confirmExpenseDraftSchema,
} from '@/lib/schemas/purchase';
import { EXPENSE_ITEM_LABEL_MAX, EXPENSE_ITEMS_MAX } from '@/config/constants';

describe('purchaseLineInputSchema', () => {
  it('rawLabel requis (vide refusé)', () => {
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Farine T45' }).success
    ).toBe(true);
    expect(purchaseLineInputSchema.safeParse({ rawLabel: '' }).success).toBe(
      false
    );
    expect(purchaseLineInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejette un rawLabel trop long', () => {
    expect(
      purchaseLineInputSchema.safeParse({
        rawLabel: 'a'.repeat(EXPENSE_ITEM_LABEL_MAX + 1),
      }).success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({
        rawLabel: 'a'.repeat(EXPENSE_ITEM_LABEL_MAX),
      }).success
    ).toBe(true);
  });

  it('articleId / articleName / formatQty / formatSize / unit / unitPrice / amount optionnels', () => {
    const r = purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.articleId).toBeUndefined();
      expect(r.data.articleName).toBeUndefined();
      expect(r.data.formatQty).toBeUndefined();
      expect(r.data.formatSize).toBeUndefined();
      expect(r.data.unit).toBeUndefined();
      expect(r.data.unitPrice).toBeUndefined();
      expect(r.data.amount).toBeUndefined();
    }
    expect(
      purchaseLineInputSchema.safeParse({
        rawLabel: 'Sucre',
        articleId: 'art_1',
        articleName: 'Sucre en poudre',
        formatQty: 2,
        formatSize: 25,
        unit: 'kg',
        unitPrice: 15000,
        amount: 30000,
      }).success
    ).toBe(true);
  });

  it('unitPrice / amount rejettent les négatifs, acceptent 0', () => {
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', unitPrice: 0 })
        .success
    ).toBe(true);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', unitPrice: -1 })
        .success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', amount: 0 })
        .success
    ).toBe(true);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', amount: -1 })
        .success
    ).toBe(false);
  });

  it('formatQty / formatSize rejettent 0 et les négatifs (positifs stricts)', () => {
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', formatQty: 0 })
        .success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', formatQty: -1 })
        .success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', formatSize: 0 })
        .success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', formatSize: -1 })
        .success
    ).toBe(false);
    expect(
      purchaseLineInputSchema.safeParse({ rawLabel: 'Sucre', formatQty: 1 })
        .success
    ).toBe(true);
  });
});

describe('preparePurchaseSchema', () => {
  const line = { rawLabel: 'Farine T45' };

  it('requiert categoryId et lines non vide', () => {
    expect(
      preparePurchaseSchema.safeParse({ categoryId: 'cat_1', lines: [line] })
        .success
    ).toBe(true);
    expect(preparePurchaseSchema.safeParse({ lines: [line] }).success).toBe(
      false
    );
    expect(
      preparePurchaseSchema.safeParse({ categoryId: 'cat_1', lines: [] })
        .success
    ).toBe(false);
    expect(
      preparePurchaseSchema.safeParse({ categoryId: '', lines: [line] }).success
    ).toBe(false);
  });

  it('rejette plus de EXPENSE_ITEMS_MAX lignes', () => {
    const lines = Array.from({ length: EXPENSE_ITEMS_MAX }, (_, i) => ({
      rawLabel: `Article ${i}`,
    }));
    expect(
      preparePurchaseSchema.safeParse({ categoryId: 'cat_1', lines }).success
    ).toBe(true);

    const tooMany = Array.from({ length: EXPENSE_ITEMS_MAX + 1 }, (_, i) => ({
      rawLabel: `Article ${i}`,
    }));
    expect(
      preparePurchaseSchema.safeParse({ categoryId: 'cat_1', lines: tooMany })
        .success
    ).toBe(false);
  });

  it('date doit être au format YYYY-MM-DD', () => {
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        date: '2026-07-12',
      }).success
    ).toBe(true);
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        date: '12/07/2026',
      }).success
    ).toBe(false);
  });

  it('totalAmount optionnel, entier', () => {
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        totalAmount: 15000,
      }).success
    ).toBe(true);
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        totalAmount: 15000.5,
      }).success
    ).toBe(false);
  });

  it('paymentMethod : enum uniquement', () => {
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        paymentMethod: 'WAVE',
      }).success
    ).toBe(true);
    expect(
      preparePurchaseSchema.safeParse({
        categoryId: 'cat_1',
        lines: [line],
        paymentMethod: 'CHEQUE',
      }).success
    ).toBe(false);
  });
});

describe('purchaseLineResolutionSchema', () => {
  it('index requis, entier >= 0', () => {
    expect(purchaseLineResolutionSchema.safeParse({ index: 0 }).success).toBe(
      true
    );
    expect(purchaseLineResolutionSchema.safeParse({}).success).toBe(false);
    expect(purchaseLineResolutionSchema.safeParse({ index: -1 }).success).toBe(
      false
    );
    expect(purchaseLineResolutionSchema.safeParse({ index: 1.5 }).success).toBe(
      false
    );
  });

  it('excluded : booléen optionnel', () => {
    expect(
      purchaseLineResolutionSchema.safeParse({ index: 0, excluded: true })
        .success
    ).toBe(true);
    expect(
      purchaseLineResolutionSchema.safeParse({ index: 0, excluded: 'yes' })
        .success
    ).toBe(false);
  });
});

describe('confirmPurchaseSchema', () => {
  it('requiert draftId', () => {
    expect(
      confirmPurchaseSchema.safeParse({ draftId: 'draft_1' }).success
    ).toBe(true);
    expect(confirmPurchaseSchema.safeParse({}).success).toBe(false);
    expect(confirmPurchaseSchema.safeParse({ draftId: '' }).success).toBe(
      false
    );
  });

  it('resolutions et overrides optionnels parsent correctement', () => {
    expect(
      confirmPurchaseSchema.safeParse({
        draftId: 'draft_1',
        resolutions: {
          lines: [
            { index: 0, excluded: true },
            { index: 1, amount: 500 },
          ],
          totalAmount: 1000,
        },
      }).success
    ).toBe(true);
  });

  it('rejette une résolution de ligne invalide', () => {
    expect(
      confirmPurchaseSchema.safeParse({
        draftId: 'draft_1',
        resolutions: { lines: [{ index: -1 }] },
      }).success
    ).toBe(false);
  });
});

describe('prepareOtherExpenseSchema', () => {
  it('requiert amount > 0 et categoryId', () => {
    expect(
      prepareOtherExpenseSchema.safeParse({ amount: 1000, categoryId: 'c' })
        .success
    ).toBe(true);
    expect(
      prepareOtherExpenseSchema.safeParse({ amount: 0, categoryId: 'c' })
        .success
    ).toBe(false);
    expect(
      prepareOtherExpenseSchema.safeParse({ amount: -100, categoryId: 'c' })
        .success
    ).toBe(false);
    expect(prepareOtherExpenseSchema.safeParse({ amount: 1000 }).success).toBe(
      false
    );
  });

  it('note / supplier / paymentMethod / date optionnels', () => {
    const r = prepareOtherExpenseSchema.safeParse({
      amount: 1000,
      categoryId: 'c',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.note).toBeUndefined();
      expect(r.data.supplier).toBeUndefined();
      expect(r.data.paymentMethod).toBeUndefined();
      expect(r.data.date).toBeUndefined();
    }
    expect(
      prepareOtherExpenseSchema.safeParse({
        amount: 1000,
        categoryId: 'c',
        note: 'Loyer juillet',
        supplier: 'Bailleur SCI',
        paymentMethod: 'BANK',
        date: '2026-07-01',
      }).success
    ).toBe(true);
  });
});

describe('confirmExpenseDraftSchema', () => {
  it('requiert draftId', () => {
    expect(
      confirmExpenseDraftSchema.safeParse({ draftId: 'draft_1' }).success
    ).toBe(true);
    expect(confirmExpenseDraftSchema.safeParse({}).success).toBe(false);
    expect(confirmExpenseDraftSchema.safeParse({ draftId: '' }).success).toBe(
      false
    );
  });
});
