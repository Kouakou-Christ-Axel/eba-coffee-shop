import { describe, it, expect } from 'vitest';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { buildCustomerGroups } from './customer-groups';
import { groupMates, summarizeKitchenGroup } from './kitchen-group';

const NOW = new Date('2026-06-13T12:00:00Z');

function make(n: number, o: Partial<PreparationOrder> = {}): PreparationOrder {
  return {
    id: `o${n}`,
    reference: `EBA-${n}`,
    dailyNumber: n,
    customerName: 'Awa',
    customerPhone: '+225 07 12 34 56 78',
    customerId: null,
    pickupTime: null,
    orderType: 'DELIVERY',
    items: [],
    note: null,
    total: 1000,
    source: 'CASHIER',
    status: 'PREPARING',
    isPaid: true,
    depositPaid: 0,
    driverRequested: false,
    driverName: null,
    driverPhone: null,
    createdAt: new Date(NOW.getTime() - n * 60_000),
    preparingStartedAt: null,
    readyAt: null,
    stockReservedAt: null,
    ...o,
  };
}

describe('groupes en cuisine', () => {
  const orders = [
    make(14),
    make(17, { customerPhone: '0712345678' }),
    make(21, { status: 'READY', driverRequested: true }),
    make(30, { customerPhone: '0101010101' }),
  ];
  const groups = buildCustomerGroups(orders, NOW);

  it('regroupe les commandes cuisine/prêtes d’un même client', () => {
    expect(groups.size).toBe(1);
    expect([...groups.values()][0].orders).toHaveLength(3);
  });

  it('sépare ce qui cuit, ce qui attend, et les livreurs à demander', () => {
    const s = summarizeKitchenGroup([...groups.values()][0]);
    expect(s.cooking.map((o) => o.dailyNumber).sort()).toEqual([14, 17]);
    expect(s.ready.map((o) => o.dailyNumber)).toEqual([21]);
    expect(s.driverTargets.map((o) => o.dailyNumber).sort()).toEqual([14, 17]);
  });

  it('liste les autres commandes du groupe', () => {
    const g = [...groups.values()][0];
    const mates = groupMates(g, orders[0]);
    expect(mates.map((o) => o.dailyNumber).sort()).toEqual([17, 21]);
    expect(groupMates(undefined, orders[0])).toEqual([]);
  });
});
