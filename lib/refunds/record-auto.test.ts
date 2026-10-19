import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefundPrisma } from './test-utils';

const { prisma } = vi.hoisted(() => ({ prisma: {} as RefundPrisma }));
vi.mock('@/lib/prisma', async () => {
  const mock = (await import('./test-utils')).refundPrismaMock();
  Object.assign(prisma, mock, { order: { findUnique: vi.fn() } });
  return { default: prisma };
});
vi.mock('@/lib/daily-numbering', () => ({
  todayDailyDate: () => new Date('2026-10-19T00:00:00Z'),
}));

import { recordAutoLateRefund } from './record-auto';

const base = {
  orderId: 'o1',
  customerName: 'Awa',
  customerPhone: '07 07 07 07 07',
  channel: 'WAVE' as const,
  amount: 3450,
};

const created = () => prisma.refund.create.mock.calls[0][0].data;

describe('recordAutoLateRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refund.findFirst.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({ customerId: 'cu1' });
  });

  it('transfert abouti : ligne PAID datée du jour, source AUTO_LATE', async () => {
    await recordAutoLateRefund({
      ...base,
      result: { kind: 'sent', status: 'success', transferId: 'wth_1', fee: 12 },
    });
    expect(created()).toMatchObject({
      source: 'AUTO_LATE',
      reason: 'LATE_PAYMENT',
      status: 'PAID',
      amount: 3450,
      jekoTransferId: 'wth_1',
      feeFcfa: 12,
      payoutDate: new Date('2026-10-19T00:00:00Z'),
      destinationPhone: '+2250707070707',
      customerId: 'cu1',
    });
  });

  it('transfert en cours : PROCESSING, suivi ensuite par le sondage', async () => {
    await recordAutoLateRefund({
      ...base,
      result: { kind: 'sent', status: 'pending', transferId: 'wth_1', fee: 12 },
    });
    expect(created()).toMatchObject({
      status: 'PROCESSING',
      paidAt: null,
      payoutDate: null,
    });
  });

  it('échec : FAILED « à corriger », corrigeable puis revalidable', async () => {
    await recordAutoLateRefund({
      ...base,
      result: { kind: 'failed', reason: 'solde Jèko insuffisant' },
    });
    expect(created()).toMatchObject({
      status: 'FAILED',
      failureCode: 'auto_failed',
      failureMessage: 'solde Jèko insuffisant',
      attempt: 0,
    });
  });

  it('référence déjà vue chez Jèko : « à vérifier »', async () => {
    await recordAutoLateRefund({ ...base, result: { kind: 'exists' } });
    expect(created()).toMatchObject({ status: 'UNCERTAIN' });
  });

  it('livraison rejouée : ne crée pas une seconde ligne', async () => {
    prisma.refund.findFirst.mockResolvedValue({ id: 'r0' });
    await recordAutoLateRefund({ ...base, result: { kind: 'exists' } });
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });
});
