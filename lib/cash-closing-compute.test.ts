// lib/cash-closing-compute.test.ts
import { describe, it, expect } from 'vitest';
import { computeClosing } from '@/lib/cash-closing-compute';

describe('computeClosing', () => {
  it('caisse théorique = fond + ventes espèces − dépenses espèces', () => {
    const r = computeClosing({
      openingFloat: 10000,
      cashSales: 50000,
      cashExpenses: 8000,
      countedCash: 52000,
    });
    expect(r.expectedCash).toBe(52000);
    expect(r.difference).toBe(0);
  });

  it('écart positif si on compte plus que prévu', () => {
    const r = computeClosing({
      openingFloat: 0,
      cashSales: 30000,
      cashExpenses: 0,
      countedCash: 31000,
    });
    expect(r.expectedCash).toBe(30000);
    expect(r.difference).toBe(1000);
  });

  it('écart négatif (manquant) si on compte moins', () => {
    const r = computeClosing({
      openingFloat: 5000,
      cashSales: 20000,
      cashExpenses: 3000,
      countedCash: 21000,
    });
    expect(r.expectedCash).toBe(22000);
    expect(r.difference).toBe(-1000);
  });
});
