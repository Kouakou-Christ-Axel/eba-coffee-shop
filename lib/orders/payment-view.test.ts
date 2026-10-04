// lib/orders/payment-view.test.ts
//
// Ce que la page de suivi sait du paiement d'une commande. Une seule fonction pure
// décide : en attente (compte à rebours, payer / réessayer), expirée, payée, ou
// sans paiement en ligne (caisse, ou commande redevenue normale après une rupture
// de stock survenue après paiement).

import { describe, expect, it } from 'vitest';
import { getPaymentView } from './payment-view';

const now = new Date('2026-10-03T12:00:00.000Z');
const future = new Date('2026-10-03T12:10:00.000Z');
const past = new Date('2026-10-03T11:50:00.000Z');

const base = {
  isPaid: false,
  status: 'NEW' as const,
  total: 3450,
  onlineFee: 35 as number | null,
  paymentExpiresAt: future as Date | null,
};

describe('getPaymentView', () => {
  it('commande en attente : échéance et montant dû (total + frais)', () => {
    expect(getPaymentView(base, now)).toEqual({
      state: 'pending',
      onlineFee: 35,
      amountDue: 3485,
      expiresAt: future.toISOString(),
    });
  });

  it('échéance dépassée : expirée', () => {
    expect(getPaymentView({ ...base, paymentExpiresAt: past }, now).state).toBe(
      'expired'
    );
  });

  it('annulée avant paiement : expirée, même si le délai court encore', () => {
    expect(getPaymentView({ ...base, status: 'CANCELLED' }, now).state).toBe(
      'expired'
    );
  });

  it('payée : le montant dû est nul, les frais restent connus', () => {
    expect(getPaymentView({ ...base, isPaid: true }, now)).toEqual({
      state: 'paid',
      onlineFee: 35,
      amountDue: 0,
      expiresAt: null,
    });
  });

  it('commande sans paiement en ligne (caisse, historique) : aucun', () => {
    expect(
      getPaymentView({ ...base, onlineFee: null, paymentExpiresAt: null }, now)
    ).toEqual({
      state: 'none',
      onlineFee: null,
      amountDue: 3450,
      expiresAt: null,
    });
  });

  it('commande redevenue normale (échéance retirée après une rupture) : aucun, à payer en caisse', () => {
    const view = getPaymentView({ ...base, paymentExpiresAt: null }, now);
    expect(view.state).toBe('none');
    expect(view.expiresAt).toBeNull();
  });

  it('commande normale déjà payée : payée', () => {
    expect(
      getPaymentView(
        { ...base, isPaid: true, onlineFee: null, paymentExpiresAt: null },
        now
      ).state
    ).toBe('paid');
  });
});
