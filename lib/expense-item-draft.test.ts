// lib/expense-item-draft.test.ts
import { describe, it, expect } from 'vitest';
import {
  emptyExpenseItemDraft,
  draftFromArticle,
  applyDraftPatch,
  draftsTotal,
  isQuantityPending,
  willCreateArticle,
  draftsToItemsInput,
  type ExpenseItemDraft,
} from '@/lib/expense-item-draft';
import { resolveExpenseItemAmount } from '@/lib/schemas/expense';
import { EXPENSE_ITEMS_MAX } from '@/config/constants';
import type { ExpenseArticleOption } from '@/lib/expense-article-search';

function draft(overrides: Partial<ExpenseItemDraft> = {}): ExpenseItemDraft {
  return { ...emptyExpenseItemDraft(), ...overrides };
}

function article(
  overrides: Partial<ExpenseArticleOption> = {}
): ExpenseArticleOption {
  return {
    id: 'art-1',
    name: 'Farine T45',
    baseUnit: 'kg',
    trackInventory: false,
    lastUnitPrice: 900,
    usageCount: 4,
    lastPurchaseDate: '2026-08-01',
    ...overrides,
  };
}

describe('draftFromArticle', () => {
  it('rattache l’article et reprend son unité de base', () => {
    const result = draftFromArticle(article());
    expect(result.articleId).toBe('art-1');
    expect(result.rawLabel).toBe('Farine T45');
    expect(result.unit).toBe('kg');
  });

  it('suggère le prix moyen et le marque comme suggestion', () => {
    const result = draftFromArticle(article({ lastUnitPrice: 900 }));
    expect(result.unitPrice).toBe('900');
    expect(result.unitPriceIsSuggestion).toBe(true);
  });

  it('laisse le prix vide quand l’article n’a pas de prix moyen', () => {
    const result = draftFromArticle(article({ lastUnitPrice: null }));
    expect(result.unitPrice).toBe('');
    expect(result.unitPriceIsSuggestion).toBe(false);
  });

  it('laisse le prix vide quand l’arrondi le fausserait (article en g)', () => {
    // 0,9 F/g : suggérer 1 F/g gonflerait tout montant de 11 %.
    const result = draftFromArticle(
      article({ baseUnit: 'g', lastUnitPrice: 0.9 })
    );
    expect(result.unitPrice).toBe('');
  });

  it('ne laisse aucune quantité pré-remplie : c’est le seul champ à saisir', () => {
    expect(draftFromArticle(article()).formatQty).toBe('');
  });
});

describe('applyDraftPatch', () => {
  it('calcule le montant depuis quantité × prix unitaire', () => {
    const result = applyDraftPatch(draft({ unitPrice: '900' }), {
      formatQty: '3',
    });
    expect(result.amount).toBe('2700');
  });

  it('tient compte de la taille du format (2 sacs de 25 kg)', () => {
    const result = applyDraftPatch(
      draft({ unitPrice: '900', formatSize: '25' }),
      { formatQty: '2' }
    );
    expect(result.amount).toBe('45000');
  });

  it('arrondit au franc', () => {
    const result = applyDraftPatch(draft({ unitPrice: '333' }), {
      formatQty: '1.5',
    });
    expect(result.amount).toBe('500');
  });

  it('ne recalcule pas quand le patch touche le montant', () => {
    const result = applyDraftPatch(
      draft({ formatQty: '3', unitPrice: '900' }),
      { amount: '1000' }
    );
    expect(result.amount).toBe('1000');
  });

  it('ne recalcule pas sur une quantité non numérique ou nulle', () => {
    expect(
      applyDraftPatch(draft({ unitPrice: '900' }), { formatQty: 'abc' }).amount
    ).toBe('');
    expect(
      applyDraftPatch(draft({ unitPrice: '900' }), { formatQty: '0' }).amount
    ).toBe('');
    expect(
      applyDraftPatch(draft({ unitPrice: '900' }), { formatQty: '-2' }).amount
    ).toBe('');
  });

  it('une saisie manuelle du prix cesse d’être une suggestion', () => {
    const result = applyDraftPatch(
      draft({ unitPrice: '900', unitPriceIsSuggestion: true }),
      { unitPrice: '1000' }
    );
    expect(result.unitPriceIsSuggestion).toBe(false);
  });

  it('reconvertit un prix suggéré quand l’unité change', () => {
    const result = applyDraftPatch(
      draft({ unit: 'g', unitPrice: '12', unitPriceIsSuggestion: true }),
      { unit: 'kg' }
    );
    expect(result.unitPrice).toBe('12000');
  });

  it('ne touche pas un prix saisi à la main quand l’unité change', () => {
    const result = applyDraftPatch(
      draft({ unit: 'kg', unitPrice: '900', unitPriceIsSuggestion: false }),
      { unit: 'g' }
    );
    expect(result.unitPrice).toBe('900');
  });
});

describe('draftsTotal', () => {
  it('somme les montants et ignore les valeurs non numériques', () => {
    expect(
      draftsTotal([
        draft({ amount: '1000' }),
        draft({ amount: '' }),
        draft({ amount: 'abc' }),
        draft({ amount: '500' }),
      ])
    ).toBe(1500);
  });

  it('vaut 0 sur une liste vide', () => {
    expect(draftsTotal([])).toBe(0);
  });
});

describe('isQuantityPending', () => {
  it('vrai quand le montant est connu sans quantité', () => {
    expect(isQuantityPending(draft({ amount: '5000' }))).toBe(true);
  });

  it('faux dès qu’une quantité est saisie', () => {
    expect(isQuantityPending(draft({ amount: '5000', formatQty: '2' }))).toBe(
      false
    );
  });

  it('faux sans montant', () => {
    expect(isQuantityPending(draft())).toBe(false);
  });
});

describe('willCreateArticle', () => {
  it('faux quand la ligne est rattachée à un article', () => {
    expect(willCreateArticle(draft({ articleId: 'a', rawLabel: 'Café' }))).toBe(
      false
    );
  });

  it('vrai quand un libellé est saisi sans article', () => {
    expect(willCreateArticle(draft({ rawLabel: 'Nouveau truc' }))).toBe(true);
  });

  it('faux sur un libellé vide ou blanc', () => {
    expect(willCreateArticle(draft({ rawLabel: '' }))).toBe(false);
    expect(willCreateArticle(draft({ rawLabel: '   ' }))).toBe(false);
  });
});

describe('draftsToItemsInput', () => {
  const VALID = [
    draft({ articleId: 'a1', rawLabel: 'Café', amount: '2000' }),
    draft({ rawLabel: 'Sucre', amount: '1500' }),
  ];

  it('garantit total === somme des montants (invariant serveur)', () => {
    const result = draftsToItemsInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sum = result.items.reduce((s, i) => s + (i.amount ?? 0), 0);
    expect(result.total).toBe(sum);
    expect(result.total).toBe(3500);
  });

  it('reste cohérent avec resolveExpenseItemAmount du schéma serveur', () => {
    const result = draftsToItemsInput([
      draft({
        rawLabel: 'Farine',
        formatQty: '2',
        formatSize: '25',
        unitPrice: '900',
        amount: '45000',
      }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sum = result.items.reduce(
      (s, i) => s + (resolveExpenseItemAmount(i) ?? 0),
      0
    );
    expect(sum).toBe(result.total);
  });

  it('envoie articleName seulement pour un nouvel article', () => {
    const result = draftsToItemsInput(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0].articleId).toBe('a1');
    expect(result.items[0].articleName).toBeUndefined();
    expect(result.items[1].articleId).toBeUndefined();
    expect(result.items[1].articleName).toBe('Sucre');
  });

  it('normalise les champs vides en null', () => {
    const result = draftsToItemsInput([
      draft({ rawLabel: 'Café', amount: '1000' }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items[0].label).toBeNull();
    expect(result.items[0].unit).toBeNull();
    expect(result.items[0].unitPrice).toBeNull();
    expect(result.items[0].formatQty).toBeNull();
  });

  it('refuse un libellé vide', () => {
    const result = draftsToItemsInput([draft({ amount: '1000' })]);
    expect(result).toEqual({
      ok: false,
      error: 'Chaque ligne doit avoir un libellé (ex. « Farine T45 »).',
    });
  });

  it('refuse un montant absent ou négatif, en nommant la ligne', () => {
    const missing = draftsToItemsInput([draft({ rawLabel: 'Café' })]);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error).toContain('Café');

    const negative = draftsToItemsInput([
      draft({ rawLabel: 'Café', amount: '-5' }),
    ]);
    expect(negative.ok).toBe(false);
  });

  it('refuse un total nul (amount.positive() côté serveur)', () => {
    const result = draftsToItemsInput([
      draft({ rawLabel: 'Échantillon', amount: '0' }),
    ]);
    expect(result).toEqual({
      ok: false,
      error: 'Le total des lignes doit être supérieur à 0 F.',
    });
  });

  it('refuse au-delà de EXPENSE_ITEMS_MAX', () => {
    const many = Array.from({ length: EXPENSE_ITEMS_MAX + 1 }, () =>
      draft({ rawLabel: 'Café', amount: '100' })
    );
    const result = draftsToItemsInput(many);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(String(EXPENSE_ITEMS_MAX));
  });

  it('accepte une ligne gratuite tant que le total reste positif', () => {
    const result = draftsToItemsInput([
      draft({ rawLabel: 'Offert', amount: '0' }),
      draft({ rawLabel: 'Café', amount: '1000' }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.total).toBe(1000);
  });
});
