// lib/supplements-form.test.ts
//
// Logique pure de l'éditeur de suppléments : élagage, validation, résumé.

import { describe, it, expect } from 'vitest';
import {
  summarizeGroup,
  toCanonicalGroup,
  validateSupplementGroups,
  pruneSupplementGroups,
  type SupplementGroup,
  type SupplementOption,
} from './supplements-form';

function option(overrides: Partial<SupplementOption> = {}): SupplementOption {
  return {
    name: 'Vanille',
    price: 0,
    available: true,
    stockQuantity: null,
    ...overrides,
  };
}

function group(overrides: Partial<SupplementGroup> = {}): SupplementGroup {
  return {
    name: 'Parfum',
    type: 'single',
    required: false,
    available: true,
    minSelect: null,
    maxSelect: null,
    options: [option()],
    ...overrides,
  };
}

/** Option jamais touchée : celle que produit un clic sur « Ajouter une option ». */
const blankOption = option({ name: '', price: 0, stockQuantity: null });

describe('pruneSupplementGroups', () => {
  it('élague un groupe jamais saisi', () => {
    const groups = [
      group(),
      group({ name: '', options: [blankOption] }),
      group({ name: '', options: [] }),
    ];

    expect(pruneSupplementGroups(groups)).toHaveLength(1);
  });

  it('conserve un groupe nommé sans option, pour qu’il soit signalé et non escamoté', () => {
    const pruned = pruneSupplementGroups([group({ options: [blankOption] })]);

    expect(pruned).toHaveLength(1);
    expect(pruned[0].options).toEqual([]);
  });

  it('coupe les espaces autour des noms', () => {
    const pruned = pruneSupplementGroups([
      group({ name: '  Parfum  ', options: [option({ name: ' Vanille ' })] }),
    ]);

    expect(pruned[0].name).toBe('Parfum');
    expect(pruned[0].options[0].name).toBe('Vanille');
  });

  it('n’ajoute aucune clé aux objets émis', () => {
    const pruned = pruneSupplementGroups([group()]);

    expect(Object.keys(pruned[0]).sort()).toEqual(
      [
        'available',
        'maxSelect',
        'minSelect',
        'name',
        'options',
        'required',
        'type',
      ].sort()
    );
    expect(Object.keys(pruned[0].options[0]).sort()).toEqual(
      ['available', 'name', 'price', 'stockQuantity'].sort()
    );
  });
});

describe('toCanonicalGroup', () => {
  // `product-form` détecte les « modifications non enregistrées » en comparant
  // deux JSON.stringify, dont l'un vient du mapping de `[productId]/page.tsx`.
  // JSON.stringify est sensible à l'ordre des clés : si cet ordre dérive, le
  // formulaire devient sale à l'ouverture, sans qu'on ait rien saisi.
  const PAGE_ORDER = [
    'name',
    'type',
    'required',
    'available',
    'minSelect',
    'maxSelect',
    'options',
  ];
  const PAGE_OPTION_ORDER = ['name', 'price', 'available', 'stockQuantity'];

  it('fige l’ordre des clés sur celui du mapping de la page produit', () => {
    const canonical = toCanonicalGroup(group());

    expect(Object.keys(canonical)).toEqual(PAGE_ORDER);
    expect(Object.keys(canonical.options[0])).toEqual(PAGE_OPTION_ORDER);
  });

  it('écarte toute clé étrangère, quel que soit l’ordre d’entrée', () => {
    // L'éditeur attache un identifiant interne à chaque groupe/option pour
    // stabiliser les clés React ; il ne doit jamais ressortir.
    const withExtras = {
      uid: 's1',
      options: [{ uid: 's2', ...group().options[0] }],
      ...group(),
    } as unknown as Parameters<typeof toCanonicalGroup>[0];

    const canonical = toCanonicalGroup(withExtras);

    expect(Object.keys(canonical)).toEqual(PAGE_ORDER);
    expect(Object.keys(canonical.options[0])).toEqual(PAGE_OPTION_ORDER);
  });

  it('produit un JSON identique à un aller-retour sans modification', () => {
    const initial = group({ options: [option(), option({ name: 'Coco' })] });

    expect(JSON.stringify(toCanonicalGroup(initial))).toBe(
      JSON.stringify(initial)
    );
  });
});

describe('validateSupplementGroups', () => {
  it('ne signale rien sur un groupe valide', () => {
    expect(validateSupplementGroups([group()]).size).toBe(0);
  });

  it('ignore un groupe jamais saisi', () => {
    const groups = [group({ name: '', options: [blankOption] })];

    expect(validateSupplementGroups(groups).size).toBe(0);
  });

  it('exige un nom de groupe dès qu’une option est saisie', () => {
    const issues = validateSupplementGroups([group({ name: '   ' })]);

    expect(issues.get(0)?.group).toContain('Nom requis');
  });

  it('exige au moins une option dans un groupe nommé', () => {
    const issues = validateSupplementGroups([
      group({ options: [blankOption] }),
    ]);

    expect(issues.get(0)?.group).toContain('Au moins une option requise');
  });

  it('refuse deux options homonymes, à la casse et aux espaces près', () => {
    const issues = validateSupplementGroups([
      group({
        options: [option({ name: 'Vanille' }), option({ name: ' vanille ' })],
      }),
    ]);

    expect(issues.get(0)?.group).toContain(
      'Deux options ne peuvent pas porter le même nom dans un groupe'
    );
    // Les deux lignes fautives sont désignées, pas seulement la seconde.
    expect(issues.get(0)?.options).toEqual([
      'Ce nom est déjà utilisé',
      'Ce nom est déjà utilisé',
    ]);
  });

  it('refuse un minimum supérieur au maximum', () => {
    const issues = validateSupplementGroups([
      group({ type: 'multiple', minSelect: 3, maxSelect: 2 }),
    ]);

    expect(issues.get(0)?.group).toContain(
      'Le minimum ne peut pas dépasser le maximum'
    );
  });

  it('signale une option à laquelle il ne manque que le nom', () => {
    // Un prix a été saisi : ce n'est plus un ajout abandonné, c'est un oubli.
    const issues = validateSupplementGroups([
      group({ options: [option({ name: '', price: 500 })] }),
    ]);

    expect(issues.get(0)?.options[0]).toBe('Nom requis');
  });

  it('rattache les erreurs au bon groupe', () => {
    const issues = validateSupplementGroups([
      group({ name: 'Parfum' }),
      group({ name: 'Sirops', options: [blankOption] }),
    ]);

    expect(issues.has(0)).toBe(false);
    expect(issues.get(1)?.group).toContain('Au moins une option requise');
  });
});

describe('summarizeGroup', () => {
  it('résume un choix unique obligatoire', () => {
    expect(
      summarizeGroup(
        group({ required: true, options: [option(), option({ name: 'Coco' })] })
      )
    ).toBe('Choix unique · Obligatoire · 2 options');
  });

  it('affiche les bornes d’un choix multiple', () => {
    expect(
      summarizeGroup(group({ type: 'multiple', minSelect: 1, maxSelect: 3 }))
    ).toBe('Choix multiples · 1 à 3 · 1 option');
  });

  it('affiche une quantité fixe quand min et max sont égaux', () => {
    expect(
      summarizeGroup(group({ type: 'quantity', minSelect: 3, maxSelect: 3 }))
    ).toBe('Quantité à répartir · 3 exactement · 1 option');
  });

  it('signale un groupe sans option', () => {
    expect(summarizeGroup(group({ options: [blankOption] }))).toBe(
      'Choix unique · aucune option'
    );
  });

  it('ignore les bornes d’un choix unique', () => {
    expect(
      summarizeGroup(group({ type: 'single', minSelect: 1, maxSelect: 2 }))
    ).toBe('Choix unique · 1 option');
  });
});
