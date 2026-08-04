import { describe, it, expect } from 'vitest';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderStatus } from '@/generated/prisma/client';
import { DEFAULT_LOYALTY_SETTINGS } from '@/lib/loyalty-settings';
import { getUrgencyLevel } from '../urgency';
import { filterByTab, filterScheduledAhead } from './use-urgency-counts';

const NOW = new Date('2026-06-13T12:00:00Z');

// Fixture COMPLÈTE de `CashierOrder` : les champs absents ne provoquaient
// aucune erreur (tsconfig exclut les tests du type-check), mais un champ
// manquant se lit `undefined` à l'exécution et peut faire passer un test pour
// de mauvaises raisons — `isOnAccount`/`customerTrusted` sont précisément lus
// par `getUrgencyLevel`.
function makeOrder(
  id: string,
  status: OrderStatus,
  isPaid: boolean,
  pickupTime: Date | null = null,
  overrides: Partial<CashierOrder> = {}
): CashierOrder {
  return {
    id,
    reference: `EBA-${id}`,
    dailyNumber: 1,
    customerId: null,
    customerName: null,
    customerPhone: null,
    pickupTime,
    orderType: 'TAKEAWAY',
    items: [],
    note: null,
    total: 1000,
    loyaltyDiscount: null,
    loyaltyRewardId: null,
    status,
    isPaid,
    isOnAccount: false,
    customerTrusted: false,
    paymentMode: null,
    paymentProofUrl: null,
    driverRequested: false,
    driverName: null,
    driverPhone: null,
    createdAt: NOW,
    preparingStartedAt: null,
    readyAt: null,
    stockReservedAt: null,
    stockShortage: false,
    unavailableItemNames: [],
    loyaltySettings: DEFAULT_LOYALTY_SETTINGS,
    loyaltyStampCount: null,
    loyaltyPickupOutcome: null,
    ...overrides,
  };
}

/** `minutes` minutes avant NOW (pour vieillir une commande). */
function createdAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
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

describe('urgence — l’ardoise n’escalade plus sur le non-paiement', () => {
  // Rappel métier : ces commandes restent NON PAYÉES (le CA ne compte que le
  // payé). Ce qui change, c'est qu'elles cessent d'être traitées comme
  // URGENTES : l'attente d'encaissement est assumée.
  const OLD = createdAgo(120); // très au-delà du seuil « critical » (15 min)

  it('commande sur ardoise : « à encaisser » reste normal, même après 2 h', () => {
    const order = makeOrder('a', 'PREPARING', false, null, {
      isOnAccount: true,
      createdAt: OLD,
    });
    expect(getUrgencyLevel(order, 'to-pay', NOW)).toBe('normal');
  });

  it('client de confiance : idem, même sans le drapeau isOnAccount', () => {
    const order = makeOrder('a', 'NEW', false, null, {
      customerTrusted: true,
      createdAt: OLD,
    });
    expect(getUrgencyLevel(order, 'to-pay', NOW)).toBe('normal');
  });

  it('la suppression est STRICTEMENT bornée à l’onglet « à encaisser »', () => {
    // La même commande qui traîne en cuisine ou prête depuis 2 h reste
    // critique : c'est le service qui déraille, pas l'argent.
    const inKitchen = makeOrder('a', 'PREPARING', false, null, {
      isOnAccount: true,
      customerTrusted: true,
      createdAt: OLD,
    });
    expect(getUrgencyLevel(inKitchen, 'in-progress', NOW)).toBe('critical');

    const ready = makeOrder('b', 'READY', false, null, {
      isOnAccount: true,
      customerTrusted: true,
      createdAt: OLD,
    });
    expect(getUrgencyLevel(ready, 'ready', NOW)).toBe('critical');
  });

  it('un créneau de retrait dépassé reste critique, ardoise ou non', () => {
    const overdue = makeOrder(
      'a',
      'READY',
      false,
      new Date(NOW.getTime() - 30 * 60_000),
      { isOnAccount: true, customerTrusted: true, createdAt: OLD }
    );
    expect(getUrgencyLevel(overdue, 'to-pay', NOW)).toBe('critical');
  });

  it('une commande impayée ordinaire escalade toujours', () => {
    // Garde-fou : la suppression ne doit pas déteindre sur le cas normal.
    const order = makeOrder('a', 'NEW', false, null, { createdAt: OLD });
    expect(getUrgencyLevel(order, 'to-pay', NOW)).toBe('critical');
  });

  it('reste listée dans « à encaisser » : l’argent est bel et bien dû', () => {
    const order = makeOrder('a', 'PREPARING', false, null, {
      isOnAccount: true,
      createdAt: OLD,
    });
    expect(filterByTab([order], 'to-pay', NOW).map((o) => o.id)).toEqual(['a']);
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
