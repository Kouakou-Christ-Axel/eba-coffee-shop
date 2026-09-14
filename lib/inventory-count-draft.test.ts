import { describe, expect, it } from 'vitest';

import {
  computeDiffs,
  countEntered,
  draftToLines,
  isDraftStale,
  parseCountValue,
  reconcileDraft,
  type CountDraft,
} from './inventory-count-draft';

function draft(overrides: Partial<CountDraft> = {}): CountDraft {
  return {
    date: '2026-09-14',
    label: '',
    counts: {},
    systemAt: {},
    itemIds: [],
    startedAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('parseCountValue', () => {
  it('distingue « non comptée » de « comptée à zéro »', () => {
    // L'invariant central : un rayon vide est une information, pas une absence.
    expect(parseCountValue('')).toBeNull();
    expect(parseCountValue('   ')).toBeNull();
    expect(parseCountValue(undefined)).toBeNull();
    expect(parseCountValue('0')).toBe(0);
  });

  it('accepte les décimales et rejette le reste', () => {
    expect(parseCountValue('1.5')).toBe(1.5);
    expect(parseCountValue('-1')).toBeNull();
    expect(parseCountValue('abc')).toBeNull();
    expect(parseCountValue('Infinity')).toBeNull();
  });
});

describe('countEntered', () => {
  it('ne compte que les saisies exploitables', () => {
    expect(countEntered({ a: '3', b: '', c: '0', d: 'x' })).toBe(2);
  });
});

describe('draftToLines', () => {
  it('omet les références non comptées et suit l’ordre d’affichage', () => {
    const lines = draftToLines({ b: '2', a: '', c: '0' }, ['a', 'b', 'c']);
    expect(lines).toEqual([
      { itemId: 'b', countedQuantity: 2 },
      { itemId: 'c', countedQuantity: 0 },
    ]);
  });

  it('ignore une saisie sans référence correspondante', () => {
    expect(draftToLines({ fantome: '4' }, ['a'])).toEqual([]);
  });
});

describe('reconcileDraft', () => {
  const items = [
    { id: 'a', currentQuantity: 10 },
    { id: 'b', currentQuantity: 5 },
  ];

  it('retire les saisies des références archivées sans toucher au reste', () => {
    const result = reconcileDraft(
      draft({
        counts: { a: '9', archivee: '3' },
        systemAt: { a: 10, archivee: 3 },
        itemIds: ['a', 'b', 'archivee'],
      }),
      items
    );

    expect(result.removedIds).toEqual(['archivee']);
    expect(result.draft.counts).toEqual({ a: '9' });
    expect(result.draft.systemAt).toEqual({ a: 10 });
  });

  it('signale les nouvelles références sans rien perdre', () => {
    const result = reconcileDraft(
      draft({ counts: { a: '9' }, systemAt: { a: 10 }, itemIds: ['a'] }),
      items
    );

    // Perdre le brouillon parce qu'une référence a été créée serait le bug qui
    // condamne la fonctionnalité.
    expect(result.addedIds).toEqual(['b']);
    expect(result.draft.counts).toEqual({ a: '9' });
    expect(result.draft.itemIds).toEqual(['a', 'b']);
  });

  it('signale un stock système qui a bougé sous une saisie', () => {
    const result = reconcileDraft(
      draft({
        counts: { a: '9', b: '5' },
        systemAt: { a: 10, b: 5 },
        itemIds: ['a', 'b'],
      }),
      [
        { id: 'a', currentQuantity: 40 },
        { id: 'b', currentQuantity: 5 },
      ]
    );

    expect(result.movedIds).toEqual(['a']);
  });

  it('ne signale pas une référence non comptée dont le stock a bougé', () => {
    const result = reconcileDraft(
      draft({ counts: { a: '' }, systemAt: { a: 10 }, itemIds: ['a', 'b'] }),
      [
        { id: 'a', currentQuantity: 40 },
        { id: 'b', currentQuantity: 5 },
      ]
    );

    expect(result.movedIds).toEqual([]);
  });

  it('ne compte pas comme perdue une référence archivée jamais saisie', () => {
    const result = reconcileDraft(
      draft({ counts: { archivee: '' }, itemIds: ['a', 'b', 'archivee'] }),
      items
    );

    expect(result.removedIds).toEqual([]);
  });
});

describe('isDraftStale', () => {
  it('périme un brouillon au-delà de la durée maximale', () => {
    const d = draft({ updatedAt: 1_000 });
    expect(isDraftStale(d, 1_000 + 500, 1_000)).toBe(false);
    expect(isDraftStale(d, 1_000 + 1_500, 1_000)).toBe(true);
  });
});

describe('computeDiffs', () => {
  const items = [
    { id: 'cafe', currentQuantity: 20 },
    { id: 'lait', currentQuantity: 8 },
    { id: 'sucre', currentQuantity: 4 },
  ];

  it('trie du plus gros écart au plus petit, en valeur absolue', () => {
    const diffs = computeDiffs({ cafe: '12', lait: '9', sucre: '4' }, items);
    expect(diffs.map((d) => d.itemId)).toEqual(['cafe', 'lait']);
    expect(diffs[0].delta).toBe(-8);
    expect(diffs[1].delta).toBe(1);
  });

  it('marque en surplus un comptage supérieur au stock théorique', () => {
    // 60 comptés alors que 20 au maximum ont pu exister : il manque une entrée,
    // ce n'est pas une consommation négative.
    const [diff] = computeDiffs({ cafe: '60' }, items);
    expect(diff.surplus).toBe(true);
  });

  it('ne marque pas en surplus un manquant', () => {
    const [diff] = computeDiffs({ cafe: '12' }, items);
    expect(diff.surplus).toBe(false);
  });

  it('ignore les références conformes et non comptées', () => {
    expect(computeDiffs({ cafe: '20', lait: '' }, items)).toEqual([]);
  });
});
