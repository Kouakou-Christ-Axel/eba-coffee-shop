import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    orderPayment: { deleteMany: vi.fn() },
    refund: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/push-notify', () => ({ notifyOrderCustomer: vi.fn() }));

import prisma from '@/lib/prisma';
import { setOrderPayment } from './payment';

const count = vi.mocked(prisma.refund.count);

describe('dépaiement et remboursements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      isPaid: true,
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([{ count: 1 }] as never);
  });

  it('refuse de remettre à encaisser une commande déjà (en cours de) remboursée', async () => {
    count.mockResolvedValue(1);
    await expect(setOrderPayment('o1', false)).rejects.toMatchObject({
      httpStatus: 409,
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        orderId: 'o1',
        status: { in: ['PAID', 'PROCESSING', 'UNCERTAIN'] },
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('sans remboursement : le dépaiement se fait comme avant', async () => {
    count.mockResolvedValue(0);
    await expect(setOrderPayment('o1', false)).resolves.toEqual({
      startedPreparation: false,
    });
  });
});
