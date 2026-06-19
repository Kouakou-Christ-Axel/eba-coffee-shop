import { describe, it, expect } from 'vitest';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderStatus } from '@/generated/prisma/client';
import { filterByTab, filterScheduledAhead } from './use-urgency-counts';

const NOW = new Date('2026-06-13T12:00:00Z');

function makeOrder(
  id: string,
  status: OrderStatus,
  isPaid: boolean,
  pickupTime: Date | null = null
): CashierOrder {
  return {
    id,
    reference: `EBA-${id}`,
    dailyNumber: 1,
    customerName: null,
    customerPhone: null,
    pickupTime,
    orderType: 'TAKEAWAY',
    items: [],
    note: null,
    total: 1000,
    status,
    isPaid,
    paymentMode: null,
    driverRequested: false,
    createdAt: NOW,
  };
}

/** `minutes` minutes après NOW. */
function pickupIn(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

describe('filterByTab — onglet "à encaisser"', () => {
  it('garde une commande récupérée (COMPLETED) mais non encaissée', () => {
    // Régression : une commande remise sans encaissement ne doit pas
    // disparaître de la file caisse.
    const orders = [makeOrder('a', 'COMPLETED', false)];
    expect(filterByTab(orders, 'to-pay', NOW).map((o) => o.id)).toEqual(['a']);
  });

  it('exclut une commande payée', () => {
    const orders = [makeOrder('a', 'READY', true)];
    expect(filterByTab(orders, 'to-pay', NOW)).toHaveLength(0);
  });

  it('exclut une commande annulée même non payée', () => {
    const orders = [makeOrder('a', 'CANCELLED', false)];
    expect(filterByTab(orders, 'to-pay', NOW)).toHaveLength(0);
  });

  it('garde les commandes non payées en cours de cycle', () => {
    const orders = [
      makeOrder('a', 'NEW', false),
      makeOrder('b', 'PREPARING', false),
      makeOrder('c', 'READY', false),
    ];
    expect(filterByTab(orders, 'to-pay', NOW).map((o) => o.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('filterByTab — onglet "en cours" et commandes programmées', () => {
  it("exclut une commande programmée à plus d'1 h du retrait", () => {
    // Retrait dans 3 h : doit rester dans « Programmées », pas dans « En cours ».
    const orders = [makeOrder('a', 'PREPARING', true, pickupIn(180))];
    expect(filterByTab(orders, 'in-progress', NOW)).toHaveLength(0);
  });

  it("inclut une commande programmée à moins d'1 h du retrait", () => {
    const orders = [makeOrder('a', 'PREPARING', true, pickupIn(45))];
    expect(filterByTab(orders, 'in-progress', NOW).map((o) => o.id)).toEqual([
      'a',
    ]);
  });

  it('inclut une commande PREPARING sans créneau (walk-in)', () => {
    const orders = [makeOrder('a', 'PREPARING', true)];
    expect(filterByTab(orders, 'in-progress', NOW).map((o) => o.id)).toEqual([
      'a',
    ]);
  });
});

describe('filterScheduledAhead', () => {
  it("ne garde que les programmées NEW/PREPARING à plus d'1 h, triées par retrait", () => {
    const orders = [
      makeOrder('far', 'PREPARING', true, pickupIn(180)),
      makeOrder('soon', 'NEW', false, pickupIn(45)), // <1 h → flux normal
      makeOrder('ready', 'READY', true, pickupIn(200)), // prête → onglet Prête
      makeOrder('walkin', 'PREPARING', true), // pas de créneau
      makeOrder('mid', 'NEW', false, pickupIn(90)),
    ];
    // Triées par pickupTime croissant : mid (90) puis far (180).
    expect(filterScheduledAhead(orders, NOW).map((o) => o.id)).toEqual([
      'mid',
      'far',
    ]);
  });
});
