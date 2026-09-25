// lib/orders/self-service.test.ts
import { describe, expect, it } from 'vitest';
import {
  canCustomerSelfServe,
  type SelfServiceOrderState,
} from './self-service';

const eligible: SelfServiceOrderState = {
  source: 'ONLINE',
  status: 'NEW',
  isPaid: false,
  stockReservedAt: null,
  paymentProofUrl: null,
  depositPaid: 0,
  isOnAccount: false,
};

describe('canCustomerSelfServe', () => {
  it('autorise une commande en ligne neuve, sans rien d’engagé', () => {
    expect(canCustomerSelfServe(eligible)).toBe(true);
    expect(canCustomerSelfServe({ ...eligible, depositPaid: null })).toBe(true);
  });

  it.each<[string, Partial<SelfServiceOrderState>]>([
    ['commande caisse', { source: 'CASHIER' }],
    ['déjà en cuisine', { status: 'PREPARING' }],
    ['annulée', { status: 'CANCELLED' }],
    ['payée', { isPaid: true }],
    ['stock réservé', { stockReservedAt: new Date() }],
    ['preuve Wave envoyée', { paymentProofUrl: 'https://x/y.webp' }],
    ['acompte versé', { depositPaid: 5000 }],
    ['sur l’ardoise', { isOnAccount: true }],
  ])('refuse : %s', (_label, patch) => {
    expect(canCustomerSelfServe({ ...eligible, ...patch })).toBe(false);
  });
});
