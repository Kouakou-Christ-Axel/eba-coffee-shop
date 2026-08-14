// lib/expense-article-search.test.ts
import { describe, it, expect } from 'vitest';
import {
  normalizeArticleKey,
  createArticleIndex,
  compareArticlesByUsage,
  rankArticles,
  type ExpenseArticleOption,
} from '@/lib/expense-article-search';

function article(
  name: string,
  overrides: Partial<ExpenseArticleOption> = {}
): ExpenseArticleOption {
  return {
    id: name,
    name,
    baseUnit: 'kg',
    trackInventory: false,
    lastUnitPrice: null,
    usageCount: 0,
    lastPurchaseDate: null,
    ...overrides,
  };
}

function rank(
  articles: ExpenseArticleOption[],
  query: string,
  limit?: number
): string[] {
  const index = createArticleIndex(articles);
  return rankArticles(index, articles, query, { limit }).map((a) => a.name);
}

describe('normalizeArticleKey', () => {
  it('replie les accents et la casse', () => {
    expect(normalizeArticleKey('Café')).toBe('cafe');
    expect(normalizeArticleKey('LAIT CONCENTRÉ')).toBe('lait concentre');
  });

  it('réduit les espaces multiples et taille les bords', () => {
    expect(normalizeArticleKey('  Farine   T45 ')).toBe('farine t45');
  });

  it('rend la même clé pour deux graphies du même nom', () => {
    expect(normalizeArticleKey('Café')).toBe(normalizeArticleKey('  cafe  '));
  });
});

describe('compareArticlesByUsage', () => {
  it('classe le plus acheté en premier', () => {
    const a = article('Peu', { usageCount: 2 });
    const b = article('Beaucoup', { usageCount: 9 });
    expect([a, b].sort(compareArticlesByUsage)[0].name).toBe('Beaucoup');
  });

  it('à usage égal, classe le dernier achat le plus récent en premier', () => {
    const a = article('Ancien', {
      usageCount: 3,
      lastPurchaseDate: '2026-01-05',
    });
    const b = article('Recent', {
      usageCount: 3,
      lastPurchaseDate: '2026-08-01',
    });
    expect([a, b].sort(compareArticlesByUsage)[0].name).toBe('Recent');
  });

  it('à usage et date égaux, trie par nom en collation française', () => {
    const a = article('Farine');
    const b = article('Étuve');
    expect([a, b].sort(compareArticlesByUsage).map((x) => x.name)).toEqual([
      'Étuve',
      'Farine',
    ]);
  });
});

describe('rankArticles', () => {
  const CORPUS = [
    article('Café', { usageCount: 12, lastPurchaseDate: '2026-08-10' }),
    article('T45 Farine', { usageCount: 7, lastPurchaseDate: '2026-08-01' }),
    article('Sucre en poudre', { usageCount: 3 }),
    article('Beurre doux', { usageCount: 1 }),
  ];

  it('requête vide : tout le référentiel, trié par usage', () => {
    expect(rank(CORPUS, '')).toEqual([
      'Café',
      'T45 Farine',
      'Sucre en poudre',
      'Beurre doux',
    ]);
  });

  it('requête vide : respecte la limite', () => {
    expect(rank(CORPUS, '', 2)).toEqual(['Café', 'T45 Farine']);
  });

  it('catalogue vide ⇒ []', () => {
    expect(rank([], 'cafe')).toEqual([]);
    expect(rank([], '')).toEqual([]);
  });

  it('trouve malgré l’accent et l’ordre des mots', () => {
    expect(rank(CORPUS, 'cafe')).toContain('Café');
    expect(rank(CORPUS, 'farine t45')).toContain('T45 Farine');
  });

  it('respecte la limite sur une recherche', () => {
    expect(rank(CORPUS, 'e').length).toBeLessThanOrEqual(4);
    expect(rank(CORPUS, 'e', 1).length).toBeLessThanOrEqual(1);
  });

  it('à score équivalent, l’article le plus acheté passe devant', () => {
    const tie = [
      article('Sucre roux', { usageCount: 1 }),
      article('Sucre roux bio', { usageCount: 50 }),
    ];
    // Les deux matchent « sucre roux » ; c'est l'usage qui doit départager.
    expect(rank(tie, 'sucre roux')[0]).toBe('Sucre roux bio');
  });

  it('est stable entre deux appels identiques', () => {
    expect(rank(CORPUS, 'sucre')).toEqual(rank(CORPUS, 'sucre'));
  });

  it('ne mute pas le tableau source', () => {
    const source = [...CORPUS];
    rank(source, '');
    expect(source.map((a) => a.name)).toEqual(CORPUS.map((a) => a.name));
  });
});
