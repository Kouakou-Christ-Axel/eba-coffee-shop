import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/refunds/queries', () => ({ getRefundDetail: vi.fn() }));

import { toDetail, toRow } from './serialize';

const detail = {
  id: 'r1',
  orderId: 'o1',
  amount: 1000,
  reason: 'QUALITY',
  source: 'STAFF',
  status: 'FAILED',
  delivery: 'JEKO_TRANSFER',
  channel: 'WAVE',
  customerName: 'Awa',
  destinationPhone: '+2250707070707',
  createdAt: new Date('2026-10-19T10:00:00Z'),
  requestedBy: { id: 'u1', name: 'Caisse 1', email: 'caisse1@eba.test' },
  requestedById: 'u1',
  approvedBy: null,
  approvedAt: null,
  paidAt: null,
  payoutDate: null,
  stockRestoredAt: null,
  failureCode: 'insufficient_balance',
  failureMessage: null,
  restockItems: false,
  feeFcfa: 0,
  attempt: 1,
  note: null,
  order: { reference: 'EBA-20261019-AB12', dailyNumber: 7, total: 3000 },
  lines: [
    {
      id: 'l1',
      name: 'Café',
      kind: 'PRODUCT',
      optionName: null,
      quantity: 1,
      amount: 400,
    },
    {
      id: 'l2',
      name: 'Café',
      kind: 'SUPPLEMENT',
      optionName: 'Avoine',
      quantity: 1,
      amount: 100,
    },
  ],
  events: [
    {
      id: 'e1',
      fromStatus: null,
      toStatus: 'REQUESTED',
      actor: { name: 'Caisse 1', email: 'caisse1@eba.test' },
      note: null,
      createdAt: new Date('2026-10-19T10:00:00Z'),
    },
  ],
} as never;

describe('toDetail', () => {
  it('numéro en clair pour ceux qui traitent le remboursement', () => {
    expect(toDetail(detail, { seePhone: true }).phone).toBe('+2250707070707');
  });

  it('numéro masqué pour la lecture seule (comptable, analyste)', () => {
    const phone = toDetail(detail, { seePhone: false }).phone;
    expect(phone).toBe('****07');
  });

  it('nomme le supplément par son option et sérialise les dates', () => {
    const d = toDetail(detail, { seePhone: true });
    expect(d.lines.map((l) => l.name)).toEqual(['Café', 'Avoine']);
    expect(d.createdAt).toBe('2026-10-19T10:00:00.000Z');
    expect(d.events[0]).toMatchObject({ to: 'REQUESTED', actor: 'Caisse 1' });
  });
});

describe('identité du demandeur', () => {
  const withUser = (u: { name: string | null; email: string } | null) =>
    toDetail(
      {
        ...detail,
        requestedBy: u && { id: 'u1', ...u },
        approvedBy: u && { id: 'u2', ...u },
        events: [{ ...detail.events[0], actor: u }],
      } as never,
      { seePhone: true }
    );

  it("retombe sur l'e-mail quand le nom est absent ou vide", () => {
    for (const name of [null, '  ']) {
      const d = withUser({ name, email: 'awa@eba.test' });
      expect(d.requestedBy).toBe('awa@eba.test');
      expect(d.approvedBy).toBe('awa@eba.test');
      expect(d.events[0].actor).toBe('awa@eba.test');
    }
  });

  it('reste vide sans compte (supprimé)', () => {
    const d = withUser(null);
    expect(d.requestedBy).toBeNull();
    expect(d.events[0].actor).toBeNull();
  });
});

describe('toRow', () => {
  it('ne contient aucun numéro de téléphone', () => {
    const row = toRow({
      ...(detail as object),
      order: { reference: 'EBA-1', dailyNumber: 7, total: 3000 },
    } as never);
    expect(JSON.stringify(row)).not.toContain('+225');
    expect(row.dailyNumber).toBe(7);
    expect(row.requestedById).toBe('u1');
  });
});
