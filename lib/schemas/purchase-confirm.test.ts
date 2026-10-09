import { describe, it, expect } from 'vitest';
import {
  purchaseLineResolutionSchema,
  confirmPurchaseSchema,
  prepareOtherExpenseSchema,
  confirmExpenseDraftSchema,
} from '@/lib/schemas/purchase';

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
