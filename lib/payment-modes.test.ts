// lib/payment-modes.test.ts
//
// Source unique des modes de paiement. La liste était recopiée à la main dans
// les stats, les régularisations, le schéma Zod et une vingtaine d'écrans : en
// ajouter un exigeait de tous les retrouver, et un oubli faisait diverger le
// détail par mode du total (clôture de caisse). Ce test compare la liste à
// l'enum Prisma pour qu'un oubli devienne un échec.

import { describe, expect, it } from 'vitest';
import { PaymentMode as PrismaPaymentMode } from '@/generated/prisma/enums';
import {
  PAYMENT_MODES,
  PAYMENT_MODE_LABELS,
  emptyModeRecord,
} from './payment-modes';

describe('PAYMENT_MODES', () => {
  it("couvre exactement l'enum Prisma, sans oubli ni doublon", () => {
    expect([...PAYMENT_MODES].sort()).toEqual(
      Object.values(PrismaPaymentMode).sort()
    );
  });

  it('inclut les moyens mobiles proposés au checkout', () => {
    expect(PAYMENT_MODES).toEqual(
      expect.arrayContaining([
        'CASH',
        'WAVE',
        'ORANGE_MONEY',
        'MTN_MONEY',
        'MOOV_MONEY',
        'DJAMO',
        'OTHER',
      ])
    );
  });
});

describe('PAYMENT_MODE_LABELS', () => {
  it('donne un libellé français non vide à chaque mode', () => {
    for (const mode of PAYMENT_MODES) {
      expect(PAYMENT_MODE_LABELS[mode]).toMatch(/\S/);
    }
  });

  it('nomme les nouveaux moyens', () => {
    expect(PAYMENT_MODE_LABELS.MTN_MONEY).toBe('MTN Money');
    expect(PAYMENT_MODE_LABELS.MOOV_MONEY).toBe('Moov Money');
    expect(PAYMENT_MODE_LABELS.DJAMO).toBe('Djamo');
  });
});

describe('emptyModeRecord', () => {
  it('met chaque mode à zéro', () => {
    const rec = emptyModeRecord();
    expect(Object.keys(rec).sort()).toEqual([...PAYMENT_MODES].sort());
    expect(Object.values(rec).every((v) => v === 0)).toBe(true);
  });

  it('renvoie un nouvel objet à chaque appel (pas de partage entre jours)', () => {
    const a = emptyModeRecord();
    a.CASH = 500;
    expect(emptyModeRecord().CASH).toBe(0);
  });
});
