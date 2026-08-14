// lib/fuzzy-search.test.ts
import { describe, it, expect } from 'vitest';
import { createFuzzyIndex } from '@/lib/fuzzy-search';

type Article = { name: string; note?: string };

const ARTICLES: Article[] = [
  { name: 'Café' },
  { name: 'T45 Farine' },
  { name: 'Sucre en poudre' },
  { name: 'Lait concentré' },
  { name: 'Beurre doux' },
];

function index(items: Article[] = ARTICLES) {
  return createFuzzyIndex(items, { keys: [{ name: 'name' }] });
}

function names(hits: { item: Article }[]): string[] {
  return hits.map((hit) => hit.item.name);
}

describe('createFuzzyIndex', () => {
  it('replie les accents dans les deux sens', () => {
    expect(names(index().search('cafe'))).toContain('Café');
    expect(names(index([{ name: 'Cafe' }]).search('Café'))).toContain('Cafe');
  });

  it('ignore l’ordre des mots', () => {
    expect(names(index().search('farine t45'))).toContain('T45 Farine');
  });

  it('trouve un match qui n’est pas en début de chaîne', () => {
    expect(names(index().search('poudre'))).toContain('Sucre en poudre');
  });

  it('tolère une faute de frappe via le repli flou', () => {
    // « farien » n'est un sous-terme exact de rien : seule la seconde passe
    // peut le rattraper.
    expect(names(index().search('farien'))).toContain('T45 Farine');
  });

  it('renvoie [] sur une requête vide ou blanche', () => {
    expect(index().search('')).toEqual([]);
    expect(index().search('   ')).toEqual([]);
  });

  it('renvoie [] sur un corpus vide', () => {
    expect(index([]).search('cafe')).toEqual([]);
  });

  it('renvoie [] sur une requête sans rapport', () => {
    expect(index().search('tracteur')).toEqual([]);
  });

  it('respecte la limite demandée', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      name: `Farine numero ${i}`,
    }));
    expect(index(many).search('farine', 5)).toHaveLength(5);
  });

  it('trie du meilleur au moins bon score', () => {
    const hits = index().search('sucre');
    const scores = hits.map((hit) => hit.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('privilégie la clé la plus pondérée', () => {
    const items: Article[] = [
      { name: 'Divers', note: 'chocolat' },
      { name: 'Chocolat', note: 'divers' },
    ];
    const weighted = createFuzzyIndex(items, {
      keys: [
        { name: 'name', weight: 3 },
        { name: 'note', weight: 1 },
      ],
    });
    expect(names(weighted.search('chocolat'))[0]).toBe('Chocolat');
  });

  it('ne casse pas sur les caractères réservés de la syntaxe étendue', () => {
    expect(() => index().search("^cafe'|=!$")).not.toThrow();
  });
});
