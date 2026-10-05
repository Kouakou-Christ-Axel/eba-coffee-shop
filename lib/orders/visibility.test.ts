// lib/orders/visibility.test.ts
//
// Une commande en ligne en attente de paiement Jèko (ou abandonnée : expirée,
// annulée avant de payer) ne doit apparaître ni à la caisse, ni en cuisine, ni
// dans les stats : le client n'a rien payé, rien ne doit être préparé. Elle se
// reconnaît à `paymentExpiresAt` non nul tant qu'elle n'est pas payée. Les
// commandes caisse et MCP n'en portent jamais.

import { describe, expect, it } from 'vitest';
import {
  STAFF_VISIBLE,
  isHiddenFromStaff,
  withStaffVisible,
} from './visibility';

const later = new Date('2026-10-03T12:15:00Z');

describe('isHiddenFromStaff', () => {
  it('masque une commande en ligne en attente de paiement', () => {
    expect(isHiddenFromStaff({ paymentExpiresAt: later, isPaid: false })).toBe(
      true
    );
  });

  it("montre une commande en ligne dès qu'elle est payée", () => {
    expect(isHiddenFromStaff({ paymentExpiresAt: later, isPaid: true })).toBe(
      false
    );
  });

  it('montre une commande caisse ou MCP (jamais de délai de paiement)', () => {
    expect(isHiddenFromStaff({ paymentExpiresAt: null, isPaid: false })).toBe(
      false
    );
    expect(isHiddenFromStaff({ paymentExpiresAt: null, isPaid: true })).toBe(
      false
    );
  });
});

describe('STAFF_VISIBLE', () => {
  it('exprime la même règle en clause Prisma', () => {
    expect(STAFF_VISIBLE).toEqual({
      OR: [{ paymentExpiresAt: null }, { isPaid: true }],
    });
  });
});

describe('withStaffVisible', () => {
  it('enveloppe une clause existante sans la modifier ni entrer en conflit', () => {
    const where = {
      status: { not: 'CANCELLED' as const },
      OR: [{ isPaid: false }, { isOnAccount: true }],
    };
    const snapshot = structuredClone(where);

    expect(withStaffVisible(where)).toEqual({ AND: [where, STAFF_VISIBLE] });
    expect(where).toEqual(snapshot);
  });

  it("ne garde que la règle de visibilité quand il n'y a pas de clause", () => {
    expect(withStaffVisible()).toEqual(STAFF_VISIBLE);
  });
});
