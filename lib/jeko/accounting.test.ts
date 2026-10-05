// lib/jeko/accounting.test.ts
//
// Comptabilité du solde Jèko : combien devrait-il y avoir sur le compte, combien
// ont coûté les frais, combien coûte un retrait. Données de départ OBSERVÉES sur
// le vrai Jèko : un paiement de 101 F laisse 99 F ; retirer 99 F débite 101 F ;
// retirer 1 000 F débite 1 015 F.

import { describe, expect, it } from 'vitest';
import {
  jekoBalance,
  maxWithdrawable,
  summarizeOnlinePayments,
  withdrawalDebit,
  withdrawalFee,
} from './accounting';

describe('frais de retrait (1,5 % arrondi au supérieur)', () => {
  it('retirer 99 F débite 101 F', () => {
    expect(withdrawalFee(99)).toBe(2);
    expect(withdrawalDebit(99)).toBe(101);
  });

  it('retirer 1 000 F débite 1 015 F', () => {
    expect(withdrawalFee(1000)).toBe(15);
    expect(withdrawalDebit(1000)).toBe(1015);
  });

  it('ne facture rien pour un retrait nul', () => {
    expect(withdrawalFee(0)).toBe(0);
  });

  it('refuse un montant négatif ou non entier', () => {
    expect(() => withdrawalFee(-1)).toThrow();
    expect(() => withdrawalFee(1.5)).toThrow();
  });
});

describe('maxWithdrawable', () => {
  it('trouve le plus gros retrait dont le débit tient dans le solde', () => {
    // 1 015 = 1 000 + 15 : exactement le solde.
    expect(maxWithdrawable(1015)).toBe(1000);
    // 101 = 99 + 2.
    expect(maxWithdrawable(101)).toBe(99);
  });

  it('ne dépasse jamais le solde, même quand l’arrondi tombe mal', () => {
    for (const balance of [0, 1, 2, 50, 99, 100, 101, 1234, 99_999]) {
      const w = maxWithdrawable(balance);
      expect(withdrawalDebit(w)).toBeLessThanOrEqual(balance);
      expect(withdrawalDebit(w + 1)).toBeGreaterThan(balance);
    }
  });
});

describe('summarizeOnlinePayments', () => {
  it('sépare ce que le client a payé, les frais clients, les frais Jèko et le coût net', () => {
    const summary = summarizeOnlinePayments([
      // Observé : 101 F payés, Jèko garde 2 F, il reste 99 F.
      { total: 100, onlineFee: 1, gatewayFee: 2, paymentAmountDue: 101 },
      { total: 1500, onlineFee: 15, gatewayFee: 23, paymentAmountDue: 1515 },
    ]);
    expect(summary).toEqual({
      count: 2,
      collected: 1616, // payé par les clients
      customerFees: 16, // 1 % facturé aux clients
      gatewayFees: 25, // prélevé par Jèko
      absorbedFees: 9, // à la charge d'EBA (≈ 0,5 %)
      netReceived: 1591, // arrivé sur Jèko
      feeUnknownCount: 0,
    });
  });

  it('retombe sur total + frais quand le montant demandé n’a pas été figé', () => {
    const summary = summarizeOnlinePayments([
      { total: 1000, onlineFee: 10, gatewayFee: 15, paymentAmountDue: null },
    ]);
    expect(summary.collected).toBe(1010);
  });

  it('signale les paiements dont les frais Jèko sont inconnus au lieu de les inventer', () => {
    const summary = summarizeOnlinePayments([
      { total: 1000, onlineFee: 10, gatewayFee: null, paymentAmountDue: 1010 },
    ]);
    expect(summary.feeUnknownCount).toBe(1);
    expect(summary.gatewayFees).toBe(0);
    expect(summary.netReceived).toBe(1010);
  });

  it('renvoie des zéros sans paiement', () => {
    expect(summarizeOnlinePayments([]).netReceived).toBe(0);
  });
});

describe('jekoBalance', () => {
  it('déduit chaque retrait avec ses frais', () => {
    expect(jekoBalance(1591, [{ amount: 1000, fee: 15 }])).toBe(576);
  });

  it('vaut le net reçu sans retrait', () => {
    expect(jekoBalance(99, [])).toBe(99);
  });
});
