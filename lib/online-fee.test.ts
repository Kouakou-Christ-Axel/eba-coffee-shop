// lib/online-fee.test.ts
//
// Frais de paiement en ligne facturés au client : `ceil(total × taux)` en FCFA
// entiers, calculés côté serveur. Le taux est réglable (Jèko peut changer son
// barème) et exprimé en pourcentage.

import { describe, expect, it } from 'vitest';
import { computeOnlineFee, withOnlineFee } from './online-fee';

describe('computeOnlineFee', () => {
  it('arrondit au FCFA supérieur (1 % de 3 450 = 34,5 → 35)', () => {
    expect(computeOnlineFee(3450, 1)).toBe(35);
  });

  it('ne facture pas un FCFA de trop quand le résultat est exact (1 % de 3 400 = 34)', () => {
    expect(computeOnlineFee(3400, 1)).toBe(34);
  });

  it('applique le taux réglé (1,5 % de 1 000 = 15)', () => {
    expect(computeOnlineFee(1000, 1.5)).toBe(15);
  });

  it("n'est pas piégé par les flottants (1,1 % de 1 000 = 11, pas 12)", () => {
    expect(computeOnlineFee(1000, 1.1)).toBe(11);
  });

  it('renvoie 0 pour un total nul ou un taux nul', () => {
    expect(computeOnlineFee(0, 1)).toBe(0);
    expect(computeOnlineFee(5000, 0)).toBe(0);
  });

  it('refuse un total négatif ou non entier', () => {
    expect(() => computeOnlineFee(-1, 1)).toThrow();
    expect(() => computeOnlineFee(10.5, 1)).toThrow();
  });

  it('refuse un taux négatif', () => {
    expect(() => computeOnlineFee(1000, -1)).toThrow();
  });
});

describe('withOnlineFee', () => {
  it('ajoute les frais au total net : net, frais et montant à payer', () => {
    expect(withOnlineFee(3000, 1)).toEqual({
      netTotal: 3000,
      fee: 30,
      amountDue: 3030,
    });
  });

  it("n'applique aucun frais à une commande entièrement couverte (rien à payer)", () => {
    expect(withOnlineFee(0, 1)).toEqual({ netTotal: 0, fee: 0, amountDue: 0 });
  });

  it('arrondit les frais au FCFA supérieur, comme le serveur', () => {
    expect(withOnlineFee(3450, 1)).toEqual({
      netTotal: 3450,
      fee: 35,
      amountDue: 3485,
    });
  });
});
