// lib/order-history.test.ts
//
// Historique local « mes commandes » : dédup, plafond, tolérance aux données
// corrompues. localStorage est simulé (environnement node, pas de jsdom).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ORDER_HISTORY_MAX } from '@/config/constants';
import {
  addOrderToHistory,
  clearOrderHistory,
  readLastContact,
  readOrderHistory,
  saveLastContact,
  type StoredOrder,
} from './order-history';

function makeOrder(overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: 'clo123',
    reference: 'EBA-20260730-AB12',
    total: 3500,
    createdAt: '2026-07-30T10:00:00.000Z',
    ...overrides,
  };
}

// Mock localStorage minimal (globalThis.window absent en environnement node).
function installLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  (globalThis as Record<string, unknown>).window = { localStorage };
  return store;
}

describe('order-history', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installLocalStorage();
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('retourne [] sans historique', () => {
    expect(readOrderHistory()).toEqual([]);
  });

  it('ajoute en tête et relit', () => {
    addOrderToHistory(makeOrder({ id: 'a' }));
    addOrderToHistory(makeOrder({ id: 'b' }));
    expect(readOrderHistory().map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('déduplique par id (la nouvelle entrée gagne)', () => {
    addOrderToHistory(makeOrder({ id: 'a', total: 1000 }));
    addOrderToHistory(makeOrder({ id: 'a', total: 2000 }));
    const orders = readOrderHistory();
    expect(orders).toHaveLength(1);
    expect(orders[0]!.total).toBe(2000);
  });

  it(`plafonne à ORDER_HISTORY_MAX (${ORDER_HISTORY_MAX})`, () => {
    for (let i = 0; i < ORDER_HISTORY_MAX + 5; i++) {
      addOrderToHistory(makeOrder({ id: `order-${i}` }));
    }
    const orders = readOrderHistory();
    expect(orders).toHaveLength(ORDER_HISTORY_MAX);
    // Les plus récentes sont conservées.
    expect(orders[0]!.id).toBe(`order-${ORDER_HISTORY_MAX + 4}`);
  });

  it('tolère un JSON corrompu', () => {
    store.set('eba-orders', '{not json');
    expect(readOrderHistory()).toEqual([]);
    // Et on peut réécrire par-dessus.
    addOrderToHistory(makeOrder());
    expect(readOrderHistory()).toHaveLength(1);
  });

  it('filtre les entrées au mauvais format', () => {
    store.set(
      'eba-orders',
      JSON.stringify([makeOrder({ id: 'ok' }), { id: 42 }, 'junk', null])
    );
    expect(readOrderHistory().map((o) => o.id)).toEqual(['ok']);
  });

  it('efface l’historique', () => {
    addOrderToHistory(makeOrder());
    clearOrderHistory();
    expect(readOrderHistory()).toEqual([]);
  });

  it('sauve et relit le dernier contact', () => {
    expect(readLastContact()).toBeNull();
    saveLastContact({ name: 'Kofi', phone: '0700123456' });
    expect(readLastContact()).toEqual({ name: 'Kofi', phone: '0700123456' });
  });

  it('tolère un contact corrompu', () => {
    store.set('eba-last-contact', '["pas","un","objet"]');
    expect(readLastContact()).toBeNull();
  });

  it('no-op sans window (SSR)', () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(readOrderHistory()).toEqual([]);
    expect(readLastContact()).toBeNull();
    expect(() => addOrderToHistory(makeOrder())).not.toThrow();
    expect(() => saveLastContact({ name: 'a', phone: 'b' })).not.toThrow();
    expect(() => clearOrderHistory()).not.toThrow();
  });
});
