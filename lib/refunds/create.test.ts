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
import { createRefund } from './create';

const items = [
  {
    cartId: 'c1',
    productId: 'p1',
    productName: 'Café',
    quantity: 2,
    basePrice: 500,
    supplements: [{ groupName: 'Lait', optionName: 'Avoine', price: 100 }],
  },
];

const order = {
  id: 'o1',
  items,
  paymentMode: 'WAVE',
  paymentTransactionId: 'txn_1',
  customerId: 'cu1',
  customerName: 'Awa',
  customerPhone: '07 07 07 07 07',
  payments: [{ mode: 'WAVE', amount: 1200 }],
};

describe('createRefund', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue(order as never);
    prisma.orderPayment.aggregate.mockResolvedValue({
      _sum: { amount: 1200 },
    } as never);
    prisma.refund.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as never);
    prisma.refund.create.mockImplementation(
      async ({ data }: { data: object }) => ({
        id: 'r1',
        ...data,
      })
    );
  });

  const base = { orderId: 'o1', amount: 500, reason: 'QUALITY' };

  it('verrouille la commande, applique les défauts (canal du client, transfert Jèko, numéro de la commande) et journalise', async () => {
    const refund = await createRefund(base, cashier);

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(refund).toMatchObject({
      status: 'REQUESTED',
      source: 'STAFF',
      channel: 'WAVE',
      delivery: 'JEKO_TRANSFER',
      destinationPhone: '+2250707070707',
      requestedById: 'cash1',
      restockItems: false,
    });
    expect(prisma.refundEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toStatus: 'REQUESTED',
        fromStatus: null,
      }),
    });
  });

  it('commande payée hors Jèko : remise en main propre', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...order,
      paymentMode: 'CASH',
      paymentTransactionId: null,
    } as never);
    await expect(createRefund(base, cashier)).resolves.toMatchObject({
      delivery: 'MANUAL',
      channel: 'CASH',
    });
  });

  it('refuse un montant au-delà du restant (déjà remboursé compté)', async () => {
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: 900 },
    } as never);
    await expect(
      createRefund({ ...base, amount: 400 }, cashier)
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it('autorise exactement le restant', async () => {
    prisma.refund.aggregate.mockResolvedValue({
      _sum: { amount: 900 },
    } as never);
    await expect(
      createRefund({ ...base, amount: 300 }, cashier)
    ).resolves.toBeTruthy();
  });

  it('refuse une commande sans paiement encaissé', async () => {
    prisma.orderPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    } as never);
    await expect(createRefund(base, cashier)).rejects.toThrow('Aucun paiement');
  });

  it('refuse un rôle qui ne demande pas de remboursement', async () => {
    await expect(createRefund(base, kitchen)).rejects.toMatchObject({
      httpStatus: 403,
    });
  });

  it('exige des lignes pour remettre en stock', async () => {
    await expect(
      createRefund({ ...base, restockItems: true }, cashier)
    ).rejects.toThrow('lignes');
  });

  it('refuse une ligne absente de la commande ou en trop grande quantité', async () => {
    const line = {
      cartId: 'c1',
      productId: 'p1',
      name: 'Café',
      kind: 'PRODUCT',
      quantity: 3,
      amount: 500,
    };
    await expect(
      createRefund({ ...base, lines: [line] }, cashier)
    ).rejects.toThrow('Quantité');
    await expect(
      createRefund(
        { ...base, lines: [{ ...line, cartId: 'zz', quantity: 1 }] },
        cashier
      )
    ).rejects.toThrow('introuvable');
  });

  it('accepte un supplément rattaché et fige les lignes', async () => {
    await createRefund(
      {
        ...base,
        restockItems: true,
        lines: [
          {
            cartId: 'c1',
            productId: 'p1',
            name: 'Café',
            kind: 'PRODUCT',
            quantity: 1,
            amount: 400,
          },
          {
            cartId: 'c1',
            productId: 'p1',
            name: 'Café — Avoine',
            kind: 'SUPPLEMENT',
            groupName: 'Lait',
            optionName: 'Avoine',
            quantity: 1,
            amount: 100,
          },
        ],
      },
      cashier
    );
    const { data } = prisma.refund.create.mock.calls[0][0];
    expect(data.lines.create).toHaveLength(2);
    expect(data.restockItems).toBe(true);
  });

  it('refuse des lignes plus chères que le remboursement', async () => {
    await expect(
      createRefund(
        {
          ...base,
          amount: 100,
          lines: [
            {
              cartId: 'c1',
              productId: 'p1',
              name: 'Café',
              kind: 'PRODUCT',
              quantity: 1,
              amount: 400,
            },
          ],
        },
        cashier
      )
    ).rejects.toThrow('dépasse');
  });

  it('transfert Jèko : refuse un numéro invalide ou un canal sans transfert (espèces)', async () => {
    await expect(
      createRefund({ ...base, destinationPhone: 'abc' }, cashier)
    ).rejects.toThrow('invalide');
    await expect(
      createRefund(
        { ...base, channel: 'CASH', delivery: 'JEKO_TRANSFER' },
        cashier
      )
    ).rejects.toThrow('transfert');
  });

  it('prévient les admins quand la caisse demande, pas quand un admin demande', async () => {
    await createRefund(base, cashier);
    expect(sendPushToRoles).toHaveBeenCalledWith(['ADMIN'], expect.anything());

    vi.mocked(sendPushToRoles).mockClear();
    await createRefund(base, admin);
    expect(sendPushToRoles).not.toHaveBeenCalled();
  });
});
