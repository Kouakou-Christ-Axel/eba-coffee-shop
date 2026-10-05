// lib/schemas/revenue-adjustment.test.ts
//
// Le mode d'une régularisation de recette suit la source unique des modes de
// paiement : le formulaire du dashboard propose tous les modes, le schéma serveur
// doit tous les accepter (sinon l'enregistrement échoue après la saisie).

import { describe, expect, it } from 'vitest';
import { PAYMENT_MODES } from '@/lib/payment-modes';
import { revenueAdjustmentPaymentModeSchema } from './revenue-adjustment';

describe('revenueAdjustmentPaymentModeSchema', () => {
  it('accepte chaque mode de la source unique', () => {
    for (const mode of PAYMENT_MODES) {
      expect(revenueAdjustmentPaymentModeSchema.safeParse(mode).success).toBe(
        true
      );
    }
  });

  it('refuse un mode inconnu', () => {
    expect(
      revenueAdjustmentPaymentModeSchema.safeParse('BITCOIN').success
    ).toBe(false);
  });
});
