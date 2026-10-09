// lib/hooks/use-public-menu.test.ts
//
// Le hook lui-même (timers, fetch, listeners) n'est pas testable sans
// jsdom/renderHook (non installés dans ce repo, cf. use-orders-stream.test.ts) :
// on vérifie la fonction pure qui reporte la popularité du rendu ISR.

import { describe, expect, it } from 'vitest';
import type { MenuCategory } from '@/config/menu';
import { carryPopularity } from './use-public-menu';

function menu(soldOut: boolean, popularRank?: number): MenuCategory[] {
  return [
    {
      id: 'c1',
      products: [{ id: 'p1', name: 'Choux', soldOut, popularRank }],
    },
  ] as unknown as MenuCategory[];
}

describe('carryPopularity', () => {
  it('reporte le rang du rendu ISR sur le menu frais', () => {
    const out = carryPopularity(menu(true), menu(false, 2));
    expect(out[0].products[0].popularRank).toBe(2);
    expect(out[0].products[0].soldOut).toBe(true);
  });

  it('renvoie le menu frais tel quel sans aucun rang à reporter', () => {
    const fresh = menu(true);
    expect(carryPopularity(fresh, menu(false))).toBe(fresh);
  });
});
