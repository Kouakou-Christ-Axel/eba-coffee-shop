import { beforeEach, describe, expect, it, vi } from 'vitest';
import { refundPrismaMock, admin, cashier, kitchen } from './test-utils';

const { prisma } = vi.hoisted(() => ({
  prisma: {} as ReturnType<typeof refundPrismaMock>,
}));
vi.mock('@/lib/prisma', async () => {
  Object.assign(prisma, (await import('./test-utils')).refundPrismaMock());
  return { default: prisma };
});
vi.mock('@/lib/push-notify', () => ({
  sendPushToRoles: vi.fn().mockResolvedValue(undefined),
}));

import { sendPushToRoles } from '@/lib/push-notify';
import {
  convertCreditToRefund,
  releaseConvertedCredit,
} from './convert-credit';

const source = {
  amount: 3000,
  delivery: 'STORE_CREDIT',
  status: 'PAID',
  orderId: 'o1',
  customerName: 'Awa',
  order: { customerId: 'cu1', customerPhone: '07 07 07 07 07' },
};
const input = {
  sourceRefundId: 'r0',
  amount: 1000,
  channel: 'WAVE',
  delivery: 'JEKO_TRANSFER',
};

describe('convertCreditToRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refund.findUnique.mockResolvedValue(source as never);
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: 500 },
    } as never);
    prisma.$queryRaw.mockResolvedValue([{ creditBalance: 3000 }] as never);
    prisma.refund.create.mockImplementation(
      async ({ data }: { data: object }) => ({ id: 'r2', ...data })
    );
  });

  it('crée une demande liée à l’avoir et débite le solde tout de suite', async () => {
    const refund = await convertCreditToRefund(input, cashier);
    expect(refund).toMatchObject({
      creditSourceId: 'r0',
      status: 'REQUESTED',
      channel: 'WAVE',
      delivery: 'JEKO_TRANSFER',
      destinationPhone: expect.stringContaining('+225'),
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cu1' },
      data: { creditBalance: 2000 },
    });
    expect(prisma.customerCreditEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'CONVERTED',
        delta: -1000,
        refundId: 'r2',
      }),
    });
    expect(sendPushToRoles).toHaveBeenCalledTimes(1);
  });

  it('refuse plus que la part de l’avoir pas encore convertie (3 000 − 500 déjà)', async () => {
    await expect(
      convertCreditToRefund({ ...input, amount: 2501 }, cashier)
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it('refuse si le client a déjà dépensé son avoir (solde insuffisant)', async () => {
    prisma.$queryRaw.mockResolvedValue([{ creditBalance: 300 }] as never);
    await expect(convertCreditToRefund(input, cashier)).rejects.toThrow(
      /insuffisant/
    );
  });

  it('refuse un avoir pas encore crédité', async () => {
    prisma.refund.findUnique.mockResolvedValue({
      ...source,
      status: 'APPROVED',
    } as never);
    await expect(convertCreditToRefund(input, cashier)).rejects.toMatchObject({
      httpStatus: 409,
    });
  });

  it('réservé aux rôles qui demandent des remboursements', async () => {
    await expect(convertCreditToRefund(input, kitchen)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });

  it('un admin qui demande n’alerte personne', async () => {
    await convertCreditToRefund(input, admin);
    expect(sendPushToRoles).not.toHaveBeenCalled();
  });
});

describe('releaseConvertedCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ creditBalance: 1000 }] as never);
  });

  it('rend la somme réservée au solde quand la conversion est refusée', async () => {
    await releaseConvertedCredit(
      prisma as never,
      { id: 'r2', amount: 1000, customerId: 'cu1', creditSourceId: 'r0' },
      'admin1'
    );
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cu1' },
      data: { creditBalance: 2000 },
    });
  });

  it('un remboursement ordinaire ne touche pas au solde', async () => {
    await releaseConvertedCredit(
      prisma as never,
      { id: 'r3', amount: 1000, customerId: 'cu1', creditSourceId: null },
      'admin1'
    );
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });
});
