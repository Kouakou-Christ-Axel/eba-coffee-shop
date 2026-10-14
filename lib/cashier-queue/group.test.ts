import { describe, it, expect } from 'vitest';
import type { OrderStatus } from '@/generated/prisma/client';
import { DEFAULT_LOYALTY_SETTINGS } from '@/lib/loyalty-settings';
import type { CashierOrder } from './types';
import { allocatePayments, summarizeGroup } from './group';
import {
  buildCustomerGroups,
  buildQueueEntries,
  customerGroupKey,
  normalizePhoneKey,
} from '@/lib/orders/customer-groups';

const NOW = new Date('2026-06-13T12:00:00Z');

function makeOrder(
  id: string,
  overrides: Partial<CashierOrder> = {}
): CashierOrder {
  return {
    id,
    reference: `EBA-${id}`,
    dailyNumber: Number(id.replace(/\D/g, '')) || 1,
    customerId: null,
    customerName: 'Awa',
    customerPhone: '+225 07 12 34 56 78',
    pickupTime: null,
    orderType: 'DELIVERY',
    items: [],
    note: null,
    total: 3000,
    depositRequired: null,
    depositPaid: null,
    loyaltyDiscount: null,
    loyaltyRewardId: null,
    status: 'PREPARING' as OrderStatus,
    isPaid: true,
    isOnAccount: false,
    customerTrusted: false,
    paymentMode: null,
    paymentAutoValidatedByAi: false,
    paymentProofUrl: null,
    paymentProofVerdict: null,
    paymentProofAnalysis: null,
    source: 'CASHIER',
    driverRequested: false,
    driverRequestedAt: null,
    driverName: null,
    driverPhone: null,
    createdAt: new Date(NOW.getTime() - Number(id.replace(/\D/g, '')) * 60_000),
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

describe('normalizePhoneKey', () => {
  it('unifie les écritures d’un même numéro ivoirien', () => {
    const a = normalizePhoneKey('+225 07 12 34 56 78');
    expect(a).toBe('+2250712345678');
    expect(normalizePhoneKey('00225 0712345678')).toBe(a);
    expect(normalizePhoneKey('07 12 34 56 78')).toBe(a);
  });

  it('refuse un numéro trop court ou vide', () => {
    expect(normalizePhoneKey('1234')).toBeNull();
    expect(normalizePhoneKey(null)).toBeNull();
  });
});

describe('customerGroupKey', () => {
  it('préfère le client lié au téléphone', () => {
    expect(customerGroupKey(makeOrder('1', { customerId: 'cus_1' }))).toBe(
      'c:cus_1'
    );
  });

  it('ne groupe jamais un anonyme sans téléphone', () => {
    expect(
      customerGroupKey(makeOrder('1', { customerPhone: null }))
    ).toBeNull();
  });
});

describe('buildCustomerGroups', () => {
  it('regroupe deux commandes du même numéro écrit différemment', () => {
    const groups = buildCustomerGroups(
      [
        makeOrder('1', { customerPhone: '+225 0712345678' }),
        makeOrder('2', { customerPhone: '07 12 34 56 78' }),
        makeOrder('3', { customerPhone: '0500000000' }),
      ],
      NOW
    );
    expect(groups.size).toBe(1);
    expect([...groups.values()][0].orders.map((o) => o.id)).toEqual(['2', '1']);
  });

  it('ignore annulées, récupérées payées et différées', () => {
    const tomorrow = new Date(NOW.getTime() + 36 * 3600_000);
    const groups = buildCustomerGroups(
      [
        makeOrder('1'),
        makeOrder('2', { status: 'CANCELLED' }),
        makeOrder('3', { status: 'COMPLETED', isPaid: true }),
        makeOrder('4', { pickupTime: tomorrow }),
      ],
      NOW
    );
    expect(groups.size).toBe(0);
  });

  it('garde une récupérée mais impayée (reste à encaisser)', () => {
    const groups = buildCustomerGroups(
      [makeOrder('1'), makeOrder('2', { status: 'COMPLETED', isPaid: false })],
      NOW
    );
    expect(groups.size).toBe(1);
  });
});

describe('buildQueueEntries', () => {
  it('place le groupe à la première commande et garde les autres en l’état', () => {
    const queue = [
      makeOrder('1'),
      makeOrder('2', { customerPhone: '0500000000' }),
      makeOrder('3'),
    ];
    const groups = buildCustomerGroups(queue, NOW);
    const entries = buildQueueEntries(queue, groups);
    expect(entries.map((e) => e.kind)).toEqual(['group', 'single']);
    const g = entries[0];
    expect(g.kind === 'group' && g.inTab.map((o) => o.id)).toEqual(['1', '3']);
  });

  it('garde un groupe même si un seul membre est dans l’onglet', () => {
    const all = [makeOrder('1'), makeOrder('2', { status: 'READY' })];
    const groups = buildCustomerGroups(all, NOW);
    const entries = buildQueueEntries([all[1]], groups);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe('group');
  });
});

describe('summarizeGroup', () => {
  it('sépare payables, acompte requis et prêtes remettables', () => {
    const group = [
      ...buildCustomerGroups(
        [
          makeOrder('1', {
            isPaid: false,
            status: 'NEW',
            total: 2000,
            depositPaid: 500,
          }),
          makeOrder('2', {
            isPaid: false,
            status: 'NEW',
            depositRequired: 1000,
            depositPaid: 0,
          }),
          makeOrder('3', { status: 'READY' }),
          makeOrder('4', { status: 'READY', isPaid: false }),
        ],
        NOW
      ).values(),
    ][0];
    const s = summarizeGroup(group);
    expect(s.payable.map((o) => o.id).sort()).toEqual(['1', '4']);
    expect(s.blockedByDeposit.map((o) => o.id)).toEqual(['2']);
    expect(s.amountToPay).toBe(1500 + 3000);
    expect(s.handable.map((o) => o.id)).toEqual(['3']);
    expect(s.driverTargets.map((o) => o.id).sort()).toEqual(['3', '4']);
  });
});

describe('allocatePayments', () => {
  const targets = [
    { orderId: 'a', amount: 3000 },
    { orderId: 'b', amount: 2000 },
    { orderId: 'c', amount: 1000 },
  ];

  it('répartit un seul mode sur chaque commande', () => {
    const out = allocatePayments([{ mode: 'WAVE', amount: 6000 }], targets);
    expect(out).toEqual([
      { orderId: 'a', payments: [{ mode: 'WAVE', amount: 3000 }] },
      { orderId: 'b', payments: [{ mode: 'WAVE', amount: 2000 }] },
      { orderId: 'c', payments: [{ mode: 'WAVE', amount: 1000 }] },
    ]);
  });

  it('coupe une ligne à cheval sur deux commandes', () => {
    const out = allocatePayments(
      [
        { mode: 'CASH', amount: 4000 },
        { mode: 'WAVE', amount: 2000 },
      ],
      targets
    );
    expect(out?.[0].payments).toEqual([{ mode: 'CASH', amount: 3000 }]);
    expect(out?.[1].payments).toEqual([
      { mode: 'CASH', amount: 1000 },
      { mode: 'WAVE', amount: 1000 },
    ]);
    expect(out?.[2].payments).toEqual([{ mode: 'WAVE', amount: 1000 }]);
  });

  it('refuse une somme qui ne couvre pas le total', () => {
    expect(
      allocatePayments([{ mode: 'CASH', amount: 5000 }], targets)
    ).toBeNull();
  });
});
