import { describe, expect, it } from 'vitest';
import { searchTokens, trgmSearch } from './trgm';
import { itemsByHits, rankByHits, scoreBucket } from './rank';

const cols = [{ sql: { text: 'x' } as never }];

describe('searchTokens', () => {
  it('replie accents et casse, sépare les mots', () => {
    expect(searchTokens('  Hélène   KOUASSI ')).toEqual(['helene', 'kouassi']);
  });

  it('saisie vide ⇒ aucun mot', () => {
    expect(searchTokens('   ')).toEqual([]);
  });
});

describe('trgmSearch', () => {
  it('saisie vide ⇒ null (pas de filtre)', () => {
    expect(trgmSearch('  ', cols)).toBeNull();
  });

  it('la saisie passe en paramètres, jamais dans le SQL', () => {
    const search = trgmSearch("x' OR 1=1 --", cols)!;
    expect(search.where.sql).not.toContain('1=1');
    expect(search.where.values).toContain("%x'%");
  });

  it('échappe les jokers LIKE saisis', () => {
    const { where } = trgmSearch('100%_', cols)!;
    expect(where.values).toContain('%100\\%\\_%');
  });

  it('coupe la tolérance aux fautes sous 3 lettres', () => {
    expect(trgmSearch('ab', cols)!.where.sql).not.toContain('word_similarity');
    expect(trgmSearch('abc', cols)!.where.sql).toContain('word_similarity');
  });
});

describe('itemsByHits / rankByHits', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('suit l’ordre de la base et ignore les ids inconnus', () => {
    expect(
      itemsByHits(items, [
        { id: 'c', score: 1 },
        { id: 'zz', score: 1 },
        { id: 'a', score: 0.5 },
      ]).map((i) => i.id)
    ).toEqual(['c', 'a']);
  });

  it('départage les scores arrondis égaux par le critère métier', () => {
    const ranked = rankByHits(
      items,
      [
        { id: 'a', score: 0.801 },
        { id: 'b', score: 0.8 },
      ],
      (x, y) => (x.id === 'b' ? -1 : y.id === 'b' ? 1 : 0)
    );
    expect(ranked.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('arrondit le score au centième', () => {
    expect(scoreBucket(0.8049)).toBe(0.8);
  });
});
