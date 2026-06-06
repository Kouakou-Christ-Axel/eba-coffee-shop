import { describe, it, expect } from 'vitest';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderStatus } from '@/generated/prisma/client';
import { filterByTab } from './use-urgency-counts';

function makeOrder(
  id: string,
  status: OrderStatus,
  isPaid: boolean
): CashierOrder {
  return {
    id,
    reference: `EBA-${id}`,
    dailyNumber: 1,
    customerName: null,
    customerPhone: null,
    pickupTime: null,
    orderType: 'TAKEAWAY',
    items: [],
    note: null,
    total: 1000,
    status,
    isPaid,
    paymentMode: null,
    driverRequested: false,
    createdAt: new Date(),
  };
}

describe('filterByTab — onglet "à encaisser"', () => {
  it('garde une commande récupérée (COMPLETED) mais non encaissée', () => {
    // Régression : une commande remise sans encaissement ne doit pas
    // disparaître de la file caisse.
    const orders = [makeOrder('a', 'COMPLETED', false)];
    expect(filterByTab(orders, 'to-pay').map((o) => o.id)).toEqual(['a']);
  });

  it('exclut une commande payée', () => {
    const orders = [makeOrder('a', 'READY', true)];
    expect(filterByTab(orders, 'to-pay')).toHaveLength(0);
  });

  it('exclut une commande annulée même non payée', () => {
    const orders = [makeOrder('a', 'CANCELLED', false)];
    expect(filterByTab(orders, 'to-pay')).toHaveLength(0);
  });

  it('garde les commandes non payées en cours de cycle', () => {
    const orders = [
      makeOrder('a', 'NEW', false),
      makeOrder('b', 'PREPARING', false),
      makeOrder('c', 'READY', false),
    ];
    expect(filterByTab(orders, 'to-pay').map((o) => o.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
