import { describe, expect, it } from 'vitest';
import { getReopenPlan } from './reopen';

const base = { isPaid: false, paymentExpiresAt: null };

describe('getReopenPlan', () => {
  it('récupérée → prête', () => {
    const plan = getReopenPlan({ ...base, isPaid: true, status: 'COMPLETED' });
    expect(plan).toMatchObject({ kind: 'completed', target: 'READY' });
  });

  it('annulée non payée → à encaisser', () => {
    expect(getReopenPlan({ ...base, status: 'CANCELLED' })).toMatchObject({
      kind: 'cancelled',
      target: 'NEW',
    });
  });

  it('expirée (paiement en ligne) → reprise en caisse', () => {
    expect(
      getReopenPlan({
        ...base,
        status: 'CANCELLED',
        paymentExpiresAt: new Date(),
      })
    ).toMatchObject({ kind: 'expired', target: 'NEW' });
  });

  it('remboursée → annule le remboursement, repart en cuisine', () => {
    expect(
      getReopenPlan({ ...base, isPaid: true, status: 'CANCELLED' })
    ).toMatchObject({ kind: 'refunded', target: 'PREPARING' });
  });

  it('rien à reprendre pour une commande active', () => {
    for (const status of ['NEW', 'PREPARING', 'READY'] as const) {
      expect(getReopenPlan({ ...base, status })).toBeNull();
    }
  });
});
