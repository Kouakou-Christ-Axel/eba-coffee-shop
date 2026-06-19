import { describe, it, expect } from 'vitest';
import { recomputePmp } from './inventory-mutations';

describe('recomputePmp', () => {
  it('part d’un stock nul : prend le coût de l’achat', () => {
    expect(recomputePmp(0, 0, 10, 6000)).toBe(6000);
  });

  it('moyenne pondérée de deux lots de même quantité', () => {
    expect(recomputePmp(10, 6000, 10, 8000)).toBe(7000);
  });

  it('ajout au même prix conserve le prix', () => {
    expect(recomputePmp(5, 1000, 5, 1000)).toBe(1000);
  });

  it('arrondit au FCFA le plus proche', () => {
    expect(recomputePmp(3, 100, 1, 150)).toBe(Math.round((300 + 150) / 4));
    expect(recomputePmp(3, 100, 1, 150)).toBe(113);
  });

  it('total nul renvoie le coût unitaire de l’achat', () => {
    expect(recomputePmp(0, 0, 0, 500)).toBe(500);
  });
});
