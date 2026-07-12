// lib/expense-matching.test.ts
//
// Teste uniquement les exports purs de `lib/expense-matching.ts`
// (`normalizeLabel`, `normalizeSupplierKey`). `ensureArticle`, `resolveArticle`
// et `learnAlias` nécessitent un client Prisma (tx) et ne sont pas testables
// sans base de données — cf. contrainte de la tâche.

import { describe, it, expect } from 'vitest';
import { normalizeLabel, normalizeSupplierKey } from '@/lib/expense-matching';

describe('normalizeLabel', () => {
  it('insensible aux accents, à la casse et aux espaces superflus', () => {
    const variants = ['Café', 'cafe', '  CAFÉ  ', 'café'];
    const normalized = variants.map(normalizeLabel);
    expect(new Set(normalized).size).toBe(1);
    expect(normalized[0]).toBe('cafe');
  });

  it('minuscule un libellé alphanumérique', () => {
    expect(normalizeLabel('Farine T45')).toBe('farine t45');
  });

  it('réduit les espaces multiples à un seul', () => {
    expect(normalizeLabel('Farine    T45')).toBe('farine t45');
    expect(normalizeLabel('  Sucre   roux  ')).toBe('sucre roux');
  });

  it('supprime les marques diacritiques courantes (é è à ç ô)', () => {
    expect(normalizeLabel('é')).toBe('e');
    expect(normalizeLabel('è')).toBe('e');
    expect(normalizeLabel('à')).toBe('a');
    expect(normalizeLabel('ç')).toBe('c');
    expect(normalizeLabel('ô')).toBe('o');
    expect(normalizeLabel('Crème brûlée à la Côte d’Ivoire')).toBe(
      'creme brulee a la cote d’ivoire'
    );
  });
});

describe('normalizeSupplierKey', () => {
  it('renvoie null pour une entrée absente ou vide', () => {
    expect(normalizeSupplierKey(null)).toBeNull();
    expect(normalizeSupplierKey(undefined)).toBeNull();
    expect(normalizeSupplierKey('')).toBeNull();
    expect(normalizeSupplierKey('   ')).toBeNull();
  });

  it('normalise un nom de fournisseur (casse, accents, espaces)', () => {
    expect(normalizeSupplierKey('Sicomarket')).toBe('sicomarket');
    expect(normalizeSupplierKey('  SICOMARKET  ')).toBe('sicomarket');
  });
});
