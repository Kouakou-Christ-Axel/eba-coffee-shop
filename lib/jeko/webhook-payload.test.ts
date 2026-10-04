// lib/jeko/webhook-payload.test.ts
//
// `TRANSACTION_COMPLETED` est la transaction elle-même, SANS enveloppe. Le
// webhook de l'entreprise reçoit TOUTES les transactions du magasin (reversements,
// liens de paiement, encaissements hors site) : on ne retient que les paiements
// qui portent une référence, le reste est ignoré sans erreur.

import { describe, expect, it } from 'vitest';
import { parseJekoTransaction } from './webhook-payload';

const payment = {
  id: 'txn_1234567890',
  amount: { amount: 348500, currency: 'XOF' },
  fees: { amount: 5228, currency: 'XOF' },
  status: 'success',
  counterpartLabel: 'John Doe',
  counterpartIdentifier: '+2250701234567',
  paymentMethod: 'wave',
  transactionType: 'payment',
  storeId: '59ae202a-f583-4a15-970f-9e99bd1e0baa',
  executedAt: '2026-10-03 14:30:25',
  transactionDetails: {
    id: 'd22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc',
    reference: 'EBA-20261003-AB12-1',
  },
};

describe('parseJekoTransaction', () => {
  it('normalise un paiement réussi (montants en FCFA)', () => {
    expect(parseJekoTransaction(payment)).toEqual({
      transactionId: 'txn_1234567890',
      status: 'success',
      amountFcfa: 3485,
      gatewayFeeFcfa: 52.28,
      paymentMethod: 'wave',
      reference: 'EBA-20261003-AB12-1',
      paymentRequestId: 'd22c81f3-ee04-4ec5-8bd2-cd8af5dabcfc',
    });
  });

  it('transmet un statut non final tel quel', () => {
    expect(
      parseJekoTransaction({ ...payment, status: 'pending' })
    ).toMatchObject({ status: 'pending' });
  });

  it('ignore un reversement', () => {
    expect(
      parseJekoTransaction({ ...payment, transactionType: 'transfer' })
    ).toBeNull();
  });

  it('ignore une transaction sans référence (lien de paiement, hors site)', () => {
    expect(
      parseJekoTransaction({
        ...payment,
        transactionDetails: { id: 'x', paymentLinkId: 'abc' },
      })
    ).toBeNull();
    expect(
      parseJekoTransaction({ ...payment, transactionDetails: {} })
    ).toBeNull();
    const withoutDetails = Object.fromEntries(
      Object.entries(payment).filter(([key]) => key !== 'transactionDetails')
    );
    expect(parseJekoTransaction(withoutDetails)).toBeNull();
  });

  it("ignore un corps qui n'est pas une transaction", () => {
    for (const body of [
      null,
      undefined,
      'texte',
      42,
      [],
      {},
      { event: 'ESCROW_REFUNDED' },
    ]) {
      expect(parseJekoTransaction(body)).toBeNull();
    }
  });

  it('ignore un statut ou un montant invalide', () => {
    expect(parseJekoTransaction({ ...payment, status: 'cheval' })).toBeNull();
    expect(
      parseJekoTransaction({ ...payment, amount: { amount: 'beaucoup' } })
    ).toBeNull();
  });
});
