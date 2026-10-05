// lib/orders/pending-payment.test.ts
//
// Commandes en ligne en attente de paiement : listées pour la caisse, ou prises en
// caisse (elles sortent de l'attente et suivent le flux d'encaissement ordinaire).

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { OrderMutationError } = vi.hoisted(() => {
  class OrderMutationError extends Error {
    constructor(
      message: string,
      readonly httpStatus: number
    ) {
      super(message);
    }
  }
  return { OrderMutationError };
});

vi.mock('@/lib/order-mutations', () => ({ OrderMutationError }));
vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

import prisma from '@/lib/prisma';
import { buildPaymentReminderMessage } from '@/lib/contact-links';
import {
  listPendingPaymentOrders,
  releasePendingOrder,
} from './pending-payment';

const findMany = vi.mocked(prisma.order.findMany);
const updateMany = vi.mocked(prisma.order.updateMany);

describe('listPendingPaymentOrders', () => {
  beforeEach(() => vi.resetAllMocks());

  it('ne liste que les commandes NEW, non payées, avec une échéance, la plus proche en tête', async () => {
    findMany.mockResolvedValue([] as never);

    await listPendingPaymentOrders();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isPaid: false,
          status: 'NEW',
          paymentExpiresAt: { not: null },
        },
        orderBy: { paymentExpiresAt: 'asc' },
      })
    );
  });
});

describe('releasePendingOrder', () => {
  beforeEach(() => vi.resetAllMocks());

  it("la sort de l'attente : plus d'échéance, donc visible et plus relançable en ligne", async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await releasePendingOrder('o1');

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'o1',
        isPaid: false,
        status: 'NEW',
        paymentExpiresAt: { not: null },
      },
      data: { paymentExpiresAt: null },
    });
  });

  it("répond 409 si la commande n'attend plus (payée, annulée ou déjà prise)", async () => {
    updateMany.mockResolvedValue({ count: 0 });

    await expect(releasePendingOrder('o1')).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe('buildPaymentReminderMessage', () => {
  it('porte le lien de suivi, le numéro et l’heure limite', () => {
    const message = buildPaymentReminderMessage({
      customerName: 'Awa',
      dailyNumber: 12,
      trackingUrl: 'https://eba-coffee.com/commande/o1',
      deadline: '14:35',
    });

    expect(message).toContain('Bonjour Awa,');
    expect(message).toContain('#012');
    expect(message).toContain('avant 14:35');
    expect(message).toContain('https://eba-coffee.com/commande/o1');
  });

  it("n'invente ni nom ni heure quand ils manquent", () => {
    const message = buildPaymentReminderMessage({
      customerName: null,
      dailyNumber: 3,
      trackingUrl: 'https://eba-coffee.com/commande/o2',
      deadline: null,
    });

    expect(message.startsWith('Bonjour,')).toBe(true);
    expect(message).not.toContain('avant');
  });
});
