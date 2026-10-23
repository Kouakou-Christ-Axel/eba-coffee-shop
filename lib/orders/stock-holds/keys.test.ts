import { describe, expect, it } from 'vitest';
import {
  computeHolds,
  holdKey,
  isFullyHeld,
  needsToMap,
  parseHoldKey,
} from './keys';

const choc = holdKey('OPTION', 'choc');
const vanille = holdKey('OPTION', 'vanille');
const gateau = holdKey('PRODUCT', 'gateau');

describe('clés de ressource', () => {
  it('se reconstruisent à l’identique, même avec ":" dans l’identifiant', () => {
    expect(parseHoldKey(holdKey('PRODUCT', 'a:b'))).toEqual({
      kind: 'PRODUCT',
      id: 'a:b',
    });
  });

  it('range le besoin d’une commande par ressource', () => {
    const map = needsToMap({
      products: new Map([['gateau', { needed: 2 }]]),
      options: new Map([['choc', { needed: 3 }]]),
    });
    expect(map.get(gateau)).toBe(2);
    expect(map.get(choc)).toBe(3);
  });
});

describe('computeHolds', () => {
  it('réserve le chocolat disponible et attend la vanille', () => {
    const needs = new Map([
      [choc, 1],
      [vanille, 1],
    ]);
    const stock = new Map<string, number | null>([
      [choc, 4],
      [vanille, 0],
    ]);
    const toHold = computeHolds(needs, new Map(), stock);
    expect(toHold.get(choc)).toBe(1);
    expect(toHold.has(vanille)).toBe(false);
  });

  it('prend ce qui reste quand le stock couvre une partie du besoin', () => {
    const toHold = computeHolds(
      new Map([[gateau, 5]]),
      new Map(),
      new Map([[gateau, 3]])
    );
    expect(toHold.get(gateau)).toBe(3);
  });

  it('ne reprend pas ce qui est déjà réservé', () => {
    const toHold = computeHolds(
      new Map([[gateau, 3]]),
      new Map([[gateau, 2]]),
      new Map([[gateau, 10]])
    );
    expect(toHold.get(gateau)).toBe(1);
  });

  it('ne réserve rien pour une cible à stock illimité ou disparue', () => {
    const toHold = computeHolds(
      new Map([
        [gateau, 2],
        [choc, 1],
      ]),
      new Map(),
      new Map<string, number | null>([[gateau, null]])
    );
    expect(toHold.size).toBe(0);
  });

  it('ne réserve rien quand tout est déjà couvert', () => {
    const toHold = computeHolds(
      new Map([[gateau, 2]]),
      new Map([[gateau, 2]]),
      new Map([[gateau, 9]])
    );
    expect(toHold.size).toBe(0);
  });
});

describe('isFullyHeld', () => {
  const needs = new Map([
    [choc, 1],
    [vanille, 2],
  ]);

  it('faux tant qu’une ressource manque', () => {
    expect(
      isFullyHeld(needs, new Map([[choc, 1]]), new Map([[vanille, 0]]))
    ).toBe(false);
  });

  it('vrai quand tout est réservé', () => {
    expect(
      isFullyHeld(
        needs,
        new Map([
          [choc, 1],
          [vanille, 2],
        ]),
        new Map()
      )
    ).toBe(true);
  });

  it('une ressource à stock illimité compte comme couverte', () => {
    expect(
      isFullyHeld(
        needs,
        new Map([[choc, 1]]),
        new Map<string, number | null>([[vanille, null]])
      )
    ).toBe(true);
  });
});
