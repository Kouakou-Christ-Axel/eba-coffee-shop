// lib/portions.test.ts
//
// Boîtes à parts fixes (« Sponge Cake x4 ») : détection, dérivation des
// emplacements depuis les compteurs, et nettoyage du libellé.

import { describe, it, expect } from 'vitest';
import type { SupplementGroup } from '@/config/menu';
import {
  isFixedPortionGroup,
  portionCount,
  portionSlots,
  stripPortionSuffix,
} from '@/lib/supplements';

function box(overrides: Partial<SupplementGroup> = {}): SupplementGroup {
  return {
    name: 'Choisissez vos goûts',
    type: 'quantity',
    required: true,
    minSelect: 4,
    maxSelect: 4,
    options: [
      { name: 'Oreo', price: 0 },
      { name: 'Kinder', price: 0 },
      { name: 'Coco', price: 0 },
    ],
    ...overrides,
  };
}

describe('isFixedPortionGroup', () => {
  it('reconnaît une boîte à bornes égales', () => {
    expect(isFixedPortionGroup(box())).toBe(true);
  });

  it('écarte un groupe aux bornes différentes', () => {
    // Config de production au moment de l'écriture : min 1 / max 4 sur un
    // produit « x4 » — une boîte pouvait partir avec une seule part choisie.
    expect(isFixedPortionGroup(box({ minSelect: 1, maxSelect: 4 }))).toBe(
      false
    );
  });

  it('écarte un groupe sans borne haute', () => {
    expect(isFixedPortionGroup(box({ minSelect: null, maxSelect: null }))).toBe(
      false
    );
  });

  it('écarte les groupes qui ne sont pas de type quantity', () => {
    expect(isFixedPortionGroup(box({ type: 'multiple' }))).toBe(false);
    expect(isFixedPortionGroup(box({ type: 'single' }))).toBe(false);
  });

  it('suit la config plutôt qu’une taille codée en dur', () => {
    const six = box({ minSelect: 6, maxSelect: 6 });
    expect(isFixedPortionGroup(six)).toBe(true);
    expect(portionCount(six)).toBe(6);
  });
});

describe('portionSlots', () => {
  const group = box();

  it('remplit les cases depuis les compteurs et complète avec des vides', () => {
    const slots = portionSlots(group, {
      'Choisissez vos goûts': { Oreo: 2, Kinder: 1 },
    });

    expect(slots).toEqual(['Oreo', 'Oreo', 'Kinder', null]);
  });

  it('rend une boîte entièrement vide sans sélection', () => {
    expect(portionSlots(group, {})).toEqual([null, null, null, null]);
  });

  it('rend une boîte pleine sans case libre', () => {
    const slots = portionSlots(group, {
      'Choisissez vos goûts': { Oreo: 2, Kinder: 2 },
    });

    expect(slots).toEqual(['Oreo', 'Oreo', 'Kinder', 'Kinder']);
    expect(slots.filter(Boolean)).toHaveLength(4);
  });

  it('ne déborde jamais de la taille de la boîte', () => {
    // Garde-fou : un état incohérent (stock qui change en cours de route) ne
    // doit pas afficher 6 cases dans une boîte de 4.
    const slots = portionSlots(group, {
      'Choisissez vos goûts': { Oreo: 4, Kinder: 2 },
    });

    expect(slots).toHaveLength(4);
  });

  it('ignore les compteurs à zéro ou négatifs', () => {
    const slots = portionSlots(group, {
      'Choisissez vos goûts': { Oreo: 1, Kinder: 0, Coco: -3 },
    });

    expect(slots).toEqual(['Oreo', null, null, null]);
  });

  it('suit l’ordre des options du groupe, pas celui de la saisie', () => {
    const slots = portionSlots(group, {
      'Choisissez vos goûts': { Coco: 1, Oreo: 1 },
    });

    expect(slots).toEqual(['Oreo', 'Coco', null, null]);
  });
});

describe('stripPortionSuffix', () => {
  it('retire un suffixe de parts saisi à la main', () => {
    expect(stripPortionSuffix('Choisissez vos goûts (3 parts)')).toBe(
      'Choisissez vos goûts'
    );
    expect(stripPortionSuffix('Choisissez vos goûts (1 part)')).toBe(
      'Choisissez vos goûts'
    );
  });

  it('laisse intact un nom sans suffixe', () => {
    expect(stripPortionSuffix('Choisissez vos goûts')).toBe(
      'Choisissez vos goûts'
    );
    expect(stripPortionSuffix('Supplément')).toBe('Supplément');
  });

  it('ne mange pas une parenthèse qui n’est pas un compte de parts', () => {
    expect(stripPortionSuffix('Goûts (au choix)')).toBe('Goûts (au choix)');
  });

  it('ne rend jamais une chaîne vide', () => {
    expect(stripPortionSuffix('(4 parts)')).toBe('(4 parts)');
  });
});
