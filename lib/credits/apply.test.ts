import { describe, expect, it } from 'vitest';
import { computeCreditApplication } from './apply';

const settings = { enabled: true, minRemaining: 1500, maxPercent: 70 };
const apply = (balance: number, total: number, over = {}) =>
  computeCreditApplication({
    balance,
    total,
    settings: { ...settings, ...over },
  });

describe('computeCreditApplication', () => {
  it('le client garde toujours au moins le reste minimum à payer', () => {
    expect(apply(5000, 3000)).toBe(1500);
    expect(apply(5000, 2000, { maxPercent: 100 })).toBe(500);
  });

  it('ne couvre jamais plus que le plafond en pourcentage', () => {
    expect(apply(9000, 8000)).toBe(5600);
    expect(apply(9000, 4000)).toBe(2500);
  });

  it('plafonné par le solde', () => {
    expect(apply(1000, 8000)).toBe(1000);
  });

  it('rien quand la commande tient dans le reste minimum', () => {
    expect(apply(5000, 1500)).toBe(0);
    expect(apply(5000, 1000)).toBe(0);
  });

  it('rien sans solde, sans total, ou désactivé', () => {
    expect(apply(0, 5000)).toBe(0);
    expect(apply(5000, 0)).toBe(0);
    expect(apply(5000, 5000, { enabled: false })).toBe(0);
  });

  it('arrondit le plafond vers le bas (jamais de centime)', () => {
    expect(apply(9000, 3333, { minRemaining: 0, maxPercent: 70 })).toBe(2333);
  });
});
