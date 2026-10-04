// lib/jeko/reference.test.ts
//
// La référence envoyée à Jèko encode la commande ET le numéro de tentative :
// `<référence commande>-<n>`. Chaque relance crée une nouvelle demande Jèko avec
// une référence neuve (Jèko refuse un doublon : 409), et le webhook retrouve la
// commande en lisant la référence — y compris celle d'une tentative antérieure
// qui aboutit après une relance.

import { describe, expect, it } from 'vitest';
import { buildJekoReference, parseJekoReference } from './reference';

describe('buildJekoReference', () => {
  it('suffixe la référence de commande par le numéro de tentative', () => {
    expect(buildJekoReference('EBA-20261003-AB12', 1)).toBe(
      'EBA-20261003-AB12-1'
    );
    expect(buildJekoReference('EBA-20261003-AB12', 12)).toBe(
      'EBA-20261003-AB12-12'
    );
  });

  it('refuse une tentative nulle, négative ou non entière', () => {
    for (const attempt of [0, -1, 1.5]) {
      expect(() => buildJekoReference('EBA-20261003-AB12', attempt)).toThrow();
    }
  });
});

describe('parseJekoReference', () => {
  it('retrouve la commande et la tentative', () => {
    expect(parseJekoReference('EBA-20261003-AB12-3')).toEqual({
      orderReference: 'EBA-20261003-AB12',
      attempt: 3,
    });
  });

  it('fait un aller-retour avec buildJekoReference', () => {
    const ref = buildJekoReference('EBA-20261231-Z9Q0', 7);
    expect(parseJekoReference(ref)).toEqual({
      orderReference: 'EBA-20261231-Z9Q0',
      attempt: 7,
    });
  });

  it.each([
    ['sans numéro de tentative', 'EBA-20261003-AB12'],
    ['référence étrangère', 'PAY-2024-001'],
    ['tentative non numérique', 'EBA-20261003-AB12-x'],
    ['tentative nulle', 'EBA-20261003-AB12-0'],
    ['suffixe en trop', 'EBA-20261003-AB12-1-2'],
    ['minuscules', 'eba-20261003-ab12-1'],
    ['vide', ''],
  ])('renvoie null pour une référence %s', (_label, ref) => {
    expect(parseJekoReference(ref)).toBeNull();
  });
});
