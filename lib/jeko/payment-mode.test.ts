// lib/jeko/payment-mode.test.ts
//
// Jèko nomme le moyen utilisé (`paymentMethod` du webhook et de la lecture
// d'une demande). On le traduit vers notre `PaymentMode`. Un moyen inconnu ou
// non proposé au checkout (`bank`, `jeko`, valeur future) tombe dans OTHER :
// le paiement est encaissé, jamais perdu faute de correspondance.

import { describe, expect, it } from 'vitest';
import { jekoMethodToPaymentMode } from './payment-mode';

describe('jekoMethodToPaymentMode', () => {
  it.each([
    ['wave', 'WAVE'],
    ['orange', 'ORANGE_MONEY'],
    ['mtn', 'MTN_MONEY'],
    ['moov', 'MOOV_MONEY'],
    ['djamo', 'DJAMO'],
  ])('traduit %s en %s', (method, mode) => {
    expect(jekoMethodToPaymentMode(method)).toBe(mode);
  });

  it.each(['bank', 'jeko', 'cheval', ''])(
    'range « %s » dans OTHER',
    (method) => {
      expect(jekoMethodToPaymentMode(method)).toBe('OTHER');
    }
  );

  it("range l'absence de moyen dans OTHER", () => {
    expect(jekoMethodToPaymentMode(undefined)).toBe('OTHER');
    expect(jekoMethodToPaymentMode(null)).toBe('OTHER');
  });
});
