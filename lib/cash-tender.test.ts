import { describe, expect, it } from 'vitest';
import { computeChange, suggestCashTenders } from './cash-tender';

describe('suggestCashTenders', () => {
  it('propose arrondis et coupures au-dessus du montant', () => {
    // 3 200 F : arrondis 3 500 / 4 000 / 5 000, puis la coupure 10 000.
    expect(suggestCashTenders(3200)).toEqual([3500, 4000, 5000, 10000]);
  });

  it('ne propose jamais lappoint exact (traité à part par lUI)', () => {
    expect(suggestCashTenders(5000)).not.toContain(5000);
    expect(suggestCashTenders(1000)).not.toContain(1000);
  });

  it('reste trié et sans doublon', () => {
    const tenders = suggestCashTenders(2000);
    expect(tenders).toEqual([...tenders].sort((a, b) => a - b));
    expect(new Set(tenders).size).toBe(tenders.length);
  });

  it('respecte la borne max', () => {
    expect(suggestCashTenders(1200, 2)).toHaveLength(2);
    expect(suggestCashTenders(1200, 2)).toEqual([1500, 2000]);
  });

  it('gère un petit montant', () => {
    expect(suggestCashTenders(300)).toEqual([500, 1000, 2000, 5000]);
  });

  it('ne propose rien pour un montant nul ou invalide', () => {
    expect(suggestCashTenders(0)).toEqual([]);
    expect(suggestCashTenders(-100)).toEqual([]);
    expect(suggestCashTenders(Number.NaN)).toEqual([]);
  });

  it('écarte les arrondis qui retombent sur le montant lui-même', () => {
    // 12 000 F est déjà un multiple de 500 et de 1 000, et dépasse toutes les
    // coupures : seul l'arrondi au 5 000 supérieur reste pertinent.
    expect(suggestCashTenders(12000)).toEqual([15000]);
  });
});

describe('computeChange', () => {
  it('calcule le rendu', () => {
    expect(computeChange(3200, 5000)).toBe(1800);
  });

  it('renvoie 0 sur un appoint exact', () => {
    expect(computeChange(3200, 3200)).toBe(0);
  });

  it('renvoie null tant que le reçu ne couvre pas le dû', () => {
    expect(computeChange(3200, 3000)).toBeNull();
    expect(computeChange(3200, 0)).toBeNull();
    expect(computeChange(3200, Number.NaN)).toBeNull();
  });
});
