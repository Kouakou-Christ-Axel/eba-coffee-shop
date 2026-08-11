// lib/menu-display.test.ts
//
// Règles d'affichage de la carte publique : ce qui remonte en tête d'une
// catégorie, et ce qui reste visible quand le client cherche ou filtre. Une
// erreur ici se voit directement sur la page — un produit perdu par le filtre
// est un produit qu'on ne vend pas.

import { describe, it, expect } from 'vitest';
import type { MenuCategory, Product } from '@/config/menu';
import {
  countProducts,
  filterMenu,
  matchesProductSearch,
  parseMenuSearchTerm,
  sortProductsForDisplay,
} from './menu-display';
import { getAbidjanWeekday } from '@/lib/timezone';

// Un jour garanti différent d'aujourd'hui (Abidjan) — évite un test flaky
// selon le jour d'exécution.
const NOT_TODAY = [(getAbidjanWeekday() + 1) % 7];
const HOUR_MS = 60 * 60 * 1000;

function product(id: string, extra: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    description: `Description ${id}`,
    price: 1000,
    ...extra,
  };
}

function category(
  id: string,
  products: Product[],
  extra: Partial<MenuCategory> = {}
): MenuCategory {
  return { id, name: id, products, ...extra };
}

/** Les quatre causes d'indisponibilité reconnues par `isOrderableNow`. */
const UNORDERABLE: Record<string, Partial<Product>> = {
  epuise: { soldOut: true },
  enPause: { unavailableUntil: new Date(Date.now() + HOUR_MS).toISOString() },
  horsPlanning: { availableDays: NOT_TODAY },
  horsFenetre: {
    weeklySpecialPeriods: [{ startDate: '2020-01-01', endDate: '2020-01-07' }],
  },
};

describe('sortProductsForDisplay', () => {
  it('remonte les commandables en tête sans perdre de produit', () => {
    const menu = [
      category('cat', [
        product('epuise', UNORDERABLE.epuise),
        product('dispo-1'),
        product('en-pause', UNORDERABLE.enPause),
        product('dispo-2'),
      ]),
    ];

    const result = sortProductsForDisplay(menu);

    expect(result[0].products.map((p) => p.id)).toEqual([
      'dispo-1',
      'dispo-2',
      'epuise',
      'en-pause',
    ]);
    expect(result[0].products).toHaveLength(4);
  });

  it('préserve l’ordre d’origine à l’intérieur de chaque groupe', () => {
    const menu = [
      category('cat', [
        product('a'),
        product('x', UNORDERABLE.epuise),
        product('b'),
        product('y', UNORDERABLE.horsPlanning),
        product('c'),
      ]),
    ];

    expect(sortProductsForDisplay(menu)[0].products.map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
      'x',
      'y',
    ]);
  });

  it.each(Object.entries(UNORDERABLE))(
    'relègue un produit %s en fin de catégorie',
    (_cause, extra) => {
      const menu = [
        category('cat', [product('bloque', extra), product('dispo')]),
      ];

      expect(sortProductsForDisplay(menu)[0].products.map((p) => p.id)).toEqual(
        ['dispo', 'bloque']
      );
    }
  );

  it('retourne la même référence quand tout est commandable', () => {
    const menu = [category('cat', [product('a'), product('b')])];
    expect(sortProductsForDisplay(menu)).toBe(menu);
  });

  it('retourne la même référence quand tout est indisponible', () => {
    const menu = [
      category('cat', [
        product('a', UNORDERABLE.epuise),
        product('b', UNORDERABLE.enPause),
      ]),
    ];
    expect(sortProductsForDisplay(menu)).toBe(menu);
  });

  it('laisse intactes les catégories homogènes d’un menu mixte', () => {
    const stable = category('stable', [product('a'), product('b')]);
    const menu = [
      stable,
      category('mixte', [
        product('epuise', UNORDERABLE.epuise),
        product('dispo'),
      ]),
    ];

    const result = sortProductsForDisplay(menu);

    expect(result).not.toBe(menu);
    expect(result[0]).toBe(stable);
    expect(result[1].products.map((p) => p.id)).toEqual(['dispo', 'epuise']);
  });
});

describe('parseMenuSearchTerm', () => {
  it.each(['', '   ', 'a', ' b '])('ignore le terme trop court %o', (term) => {
    expect(parseMenuSearchTerm(term)).toBeNull();
  });

  it('replie les accents et normalise les espaces', () => {
    expect(parseMenuSearchTerm('  Crêpe   Nutella ')).toEqual({
      normalized: 'crepe nutella',
      tokens: ['crepe', 'nutella'],
    });
  });
});

describe('matchesProductSearch', () => {
  const crepe = product('crepe-nutella', {
    name: 'Crêpe Nutella',
    description: 'Pâte à tartiner et banane',
  });

  function parse(term: string) {
    const parsed = parseMenuSearchTerm(term);
    if (!parsed) throw new Error(`terme inexploitable : ${term}`);
    return parsed;
  }

  it('trouve malgré les accents et la casse', () => {
    expect(matchesProductSearch(crepe, 'Crêpes Sucrées', parse('CREPE'))).toBe(
      true
    );
  });

  it('combine les mots en ET, dans n’importe quel ordre', () => {
    expect(
      matchesProductSearch(crepe, 'Crêpes Sucrées', parse('nutella crepe'))
    ).toBe(true);
    expect(
      matchesProductSearch(crepe, 'Crêpes Sucrées', parse('crepe fraise'))
    ).toBe(false);
  });

  it('cherche aussi dans la description', () => {
    expect(matchesProductSearch(crepe, 'Crêpes Sucrées', parse('banane'))).toBe(
      true
    );
  });

  it('cherche aussi dans le nom de la catégorie', () => {
    expect(
      matchesProductSearch(
        product('mousse'),
        'Tout chocolat',
        parse('chocolat')
      )
    ).toBe(true);
  });

  it('ne matche pas un terme absent', () => {
    expect(matchesProductSearch(crepe, 'Crêpes Sucrées', parse('bissap'))).toBe(
      false
    );
  });
});

describe('filterMenu', () => {
  // Calquée sur « Pâtisserie de la semaine » en production : 4 produits, un
  // seul commandable.
  const patisserie = category('patisserie', [
    product('chou', UNORDERABLE.epuise),
    product('eclair-cafe', { description: 'Éclair au café' }),
    product('tarte', UNORDERABLE.horsPlanning),
    product('paris-brest', UNORDERABLE.enPause),
  ]);
  const boissons = category('boissons', [
    product('cafe-glace', { name: 'Café glacé' }),
    product('bissap'),
  ]);
  const menu = [patisserie, boissons];

  it('retourne le menu par référence quand aucun critère n’est actif', () => {
    const view = filterMenu(menu, { term: '', onlyAvailable: false });

    expect(view.categories).toBe(menu);
    expect(view.isFiltered).toBe(false);
    expect(view.resultCount).toBe(view.totalCount);
    expect(view.totalCount).toBe(6);
  });

  it('traite un terme trop court comme aucun terme', () => {
    expect(
      filterMenu(menu, { term: 'c', onlyAvailable: false }).categories
    ).toBe(menu);
  });

  it('écarte les produits non commandables', () => {
    const view = filterMenu(menu, { term: '', onlyAvailable: true });

    expect(view.isFiltered).toBe(true);
    expect(view.resultCount).toBe(3);
    expect(view.totalCount).toBe(6);
    expect(view.categories[0].products.map((p) => p.id)).toEqual([
      'eclair-cafe',
    ]);
  });

  it('supprime les catégories devenues vides', () => {
    const view = filterMenu(menu, { term: 'bissap', onlyAvailable: false });

    expect(view.categories).toHaveLength(1);
    expect(view.categories[0].id).toBe('boissons');
  });

  it('combine le terme et le filtre de disponibilité', () => {
    const view = filterMenu(menu, { term: 'cafe', onlyAvailable: true });

    // « eclair-cafe » (description) et « cafe-glace » (nom) matchent tous deux,
    // et sont tous deux commandables.
    expect(view.resultCount).toBe(2);
    expect(view.categories.flatMap((c) => c.products.map((p) => p.id))).toEqual(
      ['eclair-cafe', 'cafe-glace']
    );
  });

  it('conserve la référence d’une catégorie que le filtre laisse entière', () => {
    const view = filterMenu(menu, { term: '', onlyAvailable: true });
    expect(view.categories[1]).toBe(boissons);
  });

  it('renvoie une vue vide quand rien ne correspond', () => {
    const view = filterMenu(menu, { term: 'sushi', onlyAvailable: false });

    expect(view.categories).toHaveLength(0);
    expect(view.resultCount).toBe(0);
    expect(view.isFiltered).toBe(true);
  });

  it('accorde resultCount avec le nombre de produits retournés', () => {
    const view = filterMenu(menu, { term: 'e', onlyAvailable: true });
    expect(view.resultCount).toBe(countProducts(view.categories));
  });
});
