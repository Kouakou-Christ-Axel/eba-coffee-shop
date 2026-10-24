import { describe, expect, it } from 'vitest';
import { buildJekoStats, type PaidRow } from './stats';

const paid = (over: Partial<PaidRow>): PaidRow => ({
  paidAt: new Date('2026-10-02T09:00:00Z'),
  jekoAccount: 'A',
  total: 1000,
  onlineFee: 10,
  gatewayFee: 15,
  paymentAmountDue: 1010,
  ...over,
});

const base = {
  paid: [] as PaidRow[],
  created: [],
  withdrawals: [],
  refunded: 0,
  from: '2026-10-01',
  to: '2026-10-05',
};

describe('buildJekoStats', () => {
  it('découpe par jour, en remplissant les jours sans paiement', () => {
    const stats = buildJekoStats({
      ...base,
      paid: [
        paid({}),
        paid({ paidAt: new Date('2026-10-02T20:00:00Z'), jekoAccount: 'B' }),
        paid({ paidAt: new Date('2026-10-04T08:00:00Z') }),
      ],
    });

    expect(stats.granularity).toBe('day');
    expect(stats.series.map((p) => p.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
    ]);
    expect(stats.series[1]).toMatchObject({
      collected: 2020,
      count: 2,
      A: 1010,
      B: 1010,
    });
    expect(stats.series[2]).toMatchObject({ collected: 0, count: 0 });
  });

  it('totaux : encaissé, panier moyen, frais Jèko, frais clients, coût net', () => {
    const { totals } = buildJekoStats({
      ...base,
      paid: [
        paid({}),
        paid({
          paymentAmountDue: null,
          total: 2000,
          onlineFee: 20,
          gatewayFee: 30,
        }),
      ],
      withdrawals: [
        { createdAt: new Date('2026-10-03T10:00:00Z'), amount: 1000, fee: 15 },
      ],
      refunded: 405,
    });

    expect(totals).toMatchObject({
      collected: 1010 + 2020,
      count: 2,
      averageBasket: 1515,
      gatewayFees: 45,
      customerFees: 30,
      netCost: 15,
      refunded: 405,
      withdrawn: 1000,
      withdrawalFees: 15,
    });
  });

  it('frais par mois, le plus récent d’abord, avec les frais de retrait', () => {
    const stats = buildJekoStats({
      ...base,
      from: '2026-09-01',
      to: '2026-10-05',
      paid: [paid({}), paid({ paidAt: new Date('2026-09-15T10:00:00Z') })],
      withdrawals: [
        { createdAt: new Date('2026-09-20T10:00:00Z'), amount: 500, fee: 8 },
      ],
    });

    expect(stats.months.map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    expect(stats.months[1]).toMatchObject({
      collected: 1010,
      gatewayFees: 15,
      customerFees: 10,
      netCost: 5,
      withdrawalFees: 8,
    });
  });

  it('passe à la courbe mensuelle sur une longue plage', () => {
    const stats = buildJekoStats({
      ...base,
      from: '2026-01-01',
      to: '2026-10-05',
    });
    expect(stats.granularity).toBe('month');
    expect(stats.series[0].date).toBe('2026-01');
  });

  it('conversion : payées, expirées/annulées, en attente ; taux hors en-cours', () => {
    const { conversion } = buildJekoStats({
      ...base,
      created: [
        { status: 'NEW', paymentTransactionId: 'tx1' },
        { status: 'COMPLETED', paymentTransactionId: 'tx2' },
        { status: 'CANCELLED', paymentTransactionId: null },
        { status: 'NEW', paymentTransactionId: null },
      ],
    });

    expect(conversion).toEqual({
      created: 4,
      paid: 2,
      failed: 1,
      pending: 1,
      successRate: 2 / 3,
    });
  });

  it('plage vide : zéros et taux inconnu', () => {
    const stats = buildJekoStats(base);
    expect(stats.totals.collected).toBe(0);
    expect(stats.totals.averageBasket).toBe(0);
    expect(stats.conversion.successRate).toBeNull();
    expect(stats.months).toEqual([]);
  });
});
