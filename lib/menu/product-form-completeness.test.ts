// lib/menu/product-form-completeness.test.ts
import { describe, it, expect } from 'vitest';
import {
  amountOrZero,
  costWarning,
  firstFaultyField,
  listMissingRequired,
  parseAmount,
  validateProductDraft,
  type ProductDraft,
} from './product-form-completeness';

function draft(over: Partial<ProductDraft> = {}): ProductDraft {
  return {
    name: 'Latte',
    description: 'Café au lait onctueux',
    price: '2000',
    coutMatiere: '600',
    coutEmballage: '150',
    ...over,
  };
}

describe('parseAmount', () => {
  it('accepte un entier positif et zéro', () => {
    expect(parseAmount('0')).toBe(0);
    expect(parseAmount('2500')).toBe(2500);
    expect(parseAmount(' 300 ')).toBe(300);
  });

  it('rejette le vide, les décimales et les négatifs', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('12.5')).toBeNull();
    expect(parseAmount('-3')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('validateProductDraft', () => {
  it('ne signale rien sur un brouillon complet', () => {
    expect(validateProductDraft(draft())).toEqual({});
  });

  it('exige nom, description et prix', () => {
    const errors = validateProductDraft(
      draft({ name: '  ', description: '', price: '' })
    );
    expect(errors.name).toBe('Le nom est obligatoire.');
    expect(errors.description).toBe('La description est obligatoire.');
    expect(errors.price).toBe('Indiquez un prix de vente, en francs CFA.');
  });

  it('borne la longueur du nom et de la description', () => {
    expect(validateProductDraft(draft({ name: 'a'.repeat(121) })).name).toMatch(
      /max 120/
    );
    expect(
      validateProductDraft(draft({ description: 'a'.repeat(501) })).description
    ).toMatch(/max 500/);
    // Exactement à la borne : accepté.
    expect(
      validateProductDraft(draft({ name: 'a'.repeat(120) })).name
    ).toBeUndefined();
  });

  // Le cœur du changement : les coûts vides ne bloquent plus. Ils valaient
  // « 0 » par défaut à l'écran, donc passaient en silence ; les rendre
  // obligatoires aurait forcé des valeurs inventées.
  it('laisse passer des coûts vides', () => {
    const errors = validateProductDraft(
      draft({ coutMatiere: '', coutEmballage: '' })
    );
    expect(errors.coutMatiere).toBeUndefined();
    expect(errors.coutEmballage).toBeUndefined();
  });

  it('refuse en revanche un coût qui n’est pas un entier positif', () => {
    const errors = validateProductDraft(
      draft({ coutMatiere: '-5', coutEmballage: '2.5' })
    );
    expect(errors.coutMatiere).toMatch(/entier/);
    expect(errors.coutEmballage).toMatch(/entier/);
  });

  it('refuse un prix mal formé, avec un message distinct du prix absent', () => {
    expect(validateProductDraft(draft({ price: '19.9' })).price).toMatch(
      /invalide/
    );
    expect(validateProductDraft(draft({ price: '' })).price).toMatch(
      /Indiquez un prix/
    );
  });
});

describe('listMissingRequired', () => {
  it('ne renvoie rien quand tout l’obligatoire est saisi', () => {
    expect(listMissingRequired(draft())).toEqual([]);
  });

  it('nomme chaque manque et l’onglet où le trouver', () => {
    expect(listMissingRequired(draft({ description: '', price: '' }))).toEqual([
      { field: 'description', label: 'Description', tab: 'essentiel' },
      { field: 'price', label: 'Prix de vente', tab: 'essentiel' },
    ]);
  });

  it('conserve l’ordre d’affichage des champs', () => {
    const missing = listMissingRequired(
      draft({ name: '', description: '', price: '' })
    );
    expect(missing.map((m) => m.field)).toEqual([
      'name',
      'description',
      'price',
    ]);
  });

  // Un manque n'est pas une erreur : un nom trop long est saisi, donc absent
  // du rappel — c'est la validation qui s'en charge.
  it('ignore les champs saisis mais invalides', () => {
    expect(listMissingRequired(draft({ name: 'a'.repeat(200) }))).toEqual([]);
  });

  it('ne compte pas les coûts, qui sont facultatifs', () => {
    expect(
      listMissingRequired(draft({ coutMatiere: '', coutEmballage: '' }))
    ).toEqual([]);
  });
});

describe('costWarning', () => {
  it('avertit quand un prix est posé sans aucun coût', () => {
    expect(costWarning(draft({ coutMatiere: '', coutEmballage: '' }))).toMatch(
      /marge affichée vaut le prix de vente/
    );
    expect(
      costWarning(draft({ coutMatiere: '0', coutEmballage: '0' }))
    ).not.toBeNull();
  });

  it('se tait dès qu’un seul des deux coûts est renseigné', () => {
    expect(
      costWarning(draft({ coutMatiere: '600', coutEmballage: '' }))
    ).toBeNull();
    expect(
      costWarning(draft({ coutMatiere: '', coutEmballage: '150' }))
    ).toBeNull();
  });

  it('se tait tant qu’il n’y a pas de prix — rien à comparer', () => {
    expect(
      costWarning(draft({ price: '', coutMatiere: '', coutEmballage: '' }))
    ).toBeNull();
    expect(
      costWarning(draft({ price: '0', coutMatiere: '', coutEmballage: '' }))
    ).toBeNull();
  });
});

describe('amountOrZero', () => {
  it('ramène le vide et l’invalide à 0, ce qu’attend le serveur', () => {
    expect(amountOrZero('')).toBe(0);
    expect(amountOrZero('abc')).toBe(0);
    expect(amountOrZero('750')).toBe(750);
  });
});

describe('firstFaultyField', () => {
  it('renvoie le premier fautif dans l’ordre d’affichage', () => {
    expect(
      firstFaultyField(
        validateProductDraft(draft({ description: '', name: '' }))
      )
    ).toBe('name');
    expect(
      firstFaultyField(
        validateProductDraft(draft({ price: '', coutMatiere: '-1' }))
      )
    ).toBe('price');
  });

  it('renvoie null quand il n’y a rien à corriger', () => {
    expect(firstFaultyField({})).toBeNull();
  });
});
