// lib/jeko/start-payment.test.ts
//
// Démarrer ou RELANCER le paiement d'une commande en attente. Chaque tentative :
//   - numérote sa référence (`<commande>-<n>`) : Jèko refuse une référence déjà
//     utilisée (409), et le webhook retrouve la commande en la lisant ;
//   - relance le délai de 15 min ;
//   - réclame la commande de façon atomique (gardée sur `isPaid:false`, statut NEW
//     et échéance non dépassée) : deux clics ou un paiement concurrent ne
//     créent pas deux demandes pour une commande déjà réglée.
// On ne facture JAMAIS plus que total + frais, lus en base.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    order: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/order-mutations', () => ({ getOrderShortage: vi.fn() }));
vi.mock('./client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./client')>()),
  createJekoPaymentRequest: vi.fn(),
}));

import prisma from '@/lib/prisma';
import { getOrderShortage } from '@/lib/order-mutations';
import { JekoApiError, createJekoPaymentRequest } from './client';
import { PaymentNotPendingError, startJekoPayment } from './start-payment';

const findOrder = vi.mocked(prisma.order.findUnique);
const claim = vi.mocked(prisma.order.updateMany);
const saveRequest = vi.mocked(prisma.order.update);
const createRequest = vi.mocked(createJekoPaymentRequest);
const shortage = vi.mocked(getOrderShortage);

const now = new Date('2026-10-03T12:00:00.000Z');
const config = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };
const args = {
  orderId: 'o1',
  paymentMethod: 'wave' as const,
  config,
  siteUrl: 'https://eba-coffee.com',
  now,
};

const pending = {
  id: 'o1',
  reference: 'EBA-20261003-AB12',
  isPaid: false,
  status: 'NEW',
  total: 3450,
  onlineFee: 35,
  paymentExpiresAt: new Date('2026-10-03T12:10:00.000Z'),
  pickupTime: new Date('2026-10-03T12:30:00.000Z'),
};

describe('startJekoPayment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // L'incrément et la relecture du numéro de tentative partagent UNE
    // transaction : le mock lui passe les mêmes doubles.
    vi.mocked(prisma.$transaction).mockImplementation((async (
      fn: (tx: unknown) => unknown
    ) =>
      fn({
        order: {
          updateMany: prisma.order.updateMany,
          findUniqueOrThrow: prisma.order.findUnique,
        },
      })) as never);
    findOrder
      .mockResolvedValueOnce(pending as never)
      .mockResolvedValueOnce({ paymentAttempts: 1 } as never);
    shortage.mockResolvedValue([]);
    claim.mockResolvedValue({ count: 1 });
    saveRequest.mockResolvedValue({} as never);
    createRequest.mockResolvedValue({
      id: 'pr_1',
      status: 'pending',
      redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
    });
  });

  it('refuse de faire payer un article devenu indisponible : rien n’est réclamé ni envoyé à Jèko', async () => {
    shortage.mockResolvedValue([{ name: 'Espresso', missing: 1 }] as never);

    await expect(startJekoPayment(args)).rejects.toMatchObject({
      name: 'PaymentNotPendingError',
      reason: 'out_of_stock',
    });
    expect(claim).not.toHaveBeenCalled();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it('ne contrôle pas le stock d’une commande différée (il sera produit le jour J)', async () => {
    findOrder.mockReset();
    findOrder
      .mockResolvedValueOnce({
        ...pending,
        pickupTime: new Date('2026-10-05T12:30:00.000Z'),
      } as never)
      .mockResolvedValueOnce({ paymentAttempts: 1 } as never);
    shortage.mockResolvedValue([{ name: 'Espresso', missing: 1 }] as never);

    await expect(startJekoPayment(args)).resolves.toBeDefined();
    expect(shortage).not.toHaveBeenCalled();
  });

  it("réclame la commande de façon atomique et relance l'échéance de 15 min", async () => {
    const result = await startJekoPayment(args);

    expect(claim).toHaveBeenCalledWith({
      where: {
        id: 'o1',
        isPaid: false,
        status: 'NEW',
        paymentExpiresAt: { gt: now },
      },
      data: {
        paymentAttempts: { increment: 1 },
        paymentExpiresAt: new Date('2026-10-03T12:15:00.000Z'),
        // Montant demandé à Jèko, figé : `total` peut changer ensuite.
        paymentAmountDue: 3485,
      },
    });
    expect(result.expiresAt).toEqual(new Date('2026-10-03T12:15:00.000Z'));
  });

  it('crée la demande Jèko : total + frais, référence numérotée, URLs de retour', async () => {
    const result = await startJekoPayment(args);

    expect(createRequest).toHaveBeenCalledWith(config, {
      reference: 'EBA-20261003-AB12-1',
      amountFcfa: 3485,
      paymentMethod: 'wave',
      successUrl: 'https://eba-coffee.com/commande/o1?paiement=ok',
      errorUrl: 'https://eba-coffee.com/commande/o1?paiement=echec',
    });
    expect(result.redirectUrl).toBe(
      'https://pay.jeko.africa/pay_request/pr/pr_1'
    );
  });

  it('numérote la tentative suivante pour une relance', async () => {
    findOrder
      .mockReset()
      .mockResolvedValueOnce(pending as never)
      .mockResolvedValueOnce({ paymentAttempts: 3 } as never);

    await startJekoPayment(args);

    expect(createRequest).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ reference: 'EBA-20261003-AB12-3' })
    );
  });

  it('mémorise la dernière demande Jèko sur la commande', async () => {
    await startJekoPayment(args);
    expect(saveRequest).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { paymentRequestId: 'pr_1' },
    });
  });

  it.each([
    ['not_found', null],
    ['not_online', { ...pending, onlineFee: null }],
    ['already_paid', { ...pending, isPaid: true }],
    ['cancelled', { ...pending, status: 'CANCELLED' }],
    [
      'expired',
      { ...pending, paymentExpiresAt: new Date('2026-10-03T11:59:00.000Z') },
    ],
  ])(
    'refuse sans appeler Jèko quand la commande est « %s »',
    async (reason, order) => {
      findOrder.mockReset().mockResolvedValueOnce(order as never);

      await expect(startJekoPayment(args)).rejects.toMatchObject({
        name: 'PaymentNotPendingError',
        reason,
      });
      expect(claim).not.toHaveBeenCalled();
      expect(createRequest).not.toHaveBeenCalled();
    }
  );

  it('refuse quand la commande est réglée ou expirée entre la lecture et la réclamation', async () => {
    claim.mockResolvedValue({ count: 0 });

    await expect(startJekoPayment(args)).rejects.toMatchObject({
      reason: 'conflict',
    });
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("laisse remonter l'erreur de Jèko sans mémoriser de demande", async () => {
    createRequest.mockRejectedValue(
      new JekoApiError(500, 'server_error', 'Jèko indisponible')
    );

    await expect(startJekoPayment(args)).rejects.toBeInstanceOf(JekoApiError);
    expect(saveRequest).not.toHaveBeenCalled();
  });

  it('est une erreur identifiable', () => {
    expect(new PaymentNotPendingError('expired')).toBeInstanceOf(Error);
  });
});
