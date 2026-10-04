// lib/jeko/payment-methods.test.ts
//
// Les moyens de paiement proposés au checkout : une liste unique, partagée par le
// schéma serveur, le sélecteur et le client Jèko. Chacun doit se traduire en un
// vrai mode de paiement (jamais « Autre ») et porter le même libellé que partout
// ailleurs dans l'app (caisse, stats), pour que le client et le staff parlent de
// la même chose.

import { describe, expect, it } from 'vitest';
import { PAYMENT_MODE_LABELS } from '@/lib/payment-modes';
import { jekoMethodToPaymentMode } from './payment-mode';
import {
  JEKO_PAYMENT_METHODS,
  JEKO_PAYMENT_METHOD_LABELS,
} from './payment-methods';

describe('JEKO_PAYMENT_METHODS', () => {
  it('propose Wave, Orange, MTN, Moov et Djamo', () => {
    expect([...JEKO_PAYMENT_METHODS]).toEqual([
      'wave',
      'orange',
      'mtn',
      'moov',
      'djamo',
    ]);
  });

  it.each([...JEKO_PAYMENT_METHODS])(
    '« %s » se traduit en un mode de paiement précis, jamais OTHER',
    (method) => {
      expect(jekoMethodToPaymentMode(method)).not.toBe('OTHER');
    }
  );

  it.each([...JEKO_PAYMENT_METHODS])(
    '« %s » porte le même libellé que le mode de paiement correspondant',
    (method) => {
      expect(JEKO_PAYMENT_METHOD_LABELS[method]).toBe(
        PAYMENT_MODE_LABELS[jekoMethodToPaymentMode(method)]
      );
    }
  );
});
