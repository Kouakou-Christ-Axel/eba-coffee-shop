// lib/push-notify.test.ts
//
// Tests du volet CLIENT de l'envoi push : ciblage par commande, message par
// étape, nettoyage des abonnements (fin de vie de la commande, endpoints
// morts). `web-push`, prisma et la persistance sont mockés — on teste la
// logique d'orchestration, pas l'envoi réel.

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  type Mock,
} from 'vitest';

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    pushSubscription: {
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/push-subscriptions', () => ({
  getPushSubscriptionsForOrder: vi.fn(),
  getPushSubscriptionsForRoles: vi.fn(),
  removePushSubscriptionsForOrder: vi.fn(),
}));

import webPush from 'web-push';
import prisma from '@/lib/prisma';
import {
  getPushSubscriptionsForOrder,
  removePushSubscriptionsForOrder,
} from '@/lib/push-subscriptions';
import { notifyOrderCustomer, sendPushToOrder } from '@/lib/push-notify';

const mockSend = webPush.sendNotification as unknown as Mock;
const mockGetForOrder = getPushSubscriptionsForOrder as unknown as Mock;
const mockRemoveForOrder = removePushSubscriptionsForOrder as unknown as Mock;
const mockDelete = prisma.pushSubscription.delete as unknown as Mock;

const SUB_A = {
  id: 'sub-a',
  endpoint: 'https://push/a',
  p256dh: 'k',
  auth: 'a',
};
const SUB_B = {
  id: 'sub-b',
  endpoint: 'https://push/b',
  p256dh: 'k',
  auth: 'a',
};

/** Laisse les promesses fire-and-forget de notifyOrderCustomer se résoudre. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  // ensureVapidConfigured lit l'env au premier envoi.
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue(undefined);
  mockGetForOrder.mockResolvedValue([SUB_A, SUB_B]);
  mockRemoveForOrder.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

describe('sendPushToOrder', () => {
  it('envoie le payload à chaque abonnement de la commande', async () => {
    await sendPushToOrder('order-1', { title: 'T', body: 'B' });

    expect(mockGetForOrder).toHaveBeenCalledWith('order-1');
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledWith(
      { endpoint: SUB_A.endpoint, keys: { p256dh: 'k', auth: 'a' } },
      JSON.stringify({ title: 'T', body: 'B' })
    );
  });

  it('ne supprime pas les abonnements par défaut', async () => {
    await sendPushToOrder('order-1', { title: 'T', body: 'B' });
    expect(mockRemoveForOrder).not.toHaveBeenCalled();
  });

  it('supprime les abonnements APRÈS le dernier envoi (lastForOrder)', async () => {
    await sendPushToOrder(
      'order-1',
      { title: 'T', body: 'B' },
      { lastForOrder: true }
    );
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockRemoveForOrder).toHaveBeenCalledWith('order-1');
  });

  it('nettoie un endpoint mort (410) sans faire échouer les autres envois', async () => {
    mockSend
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce(undefined);

    await sendPushToOrder('order-1', { title: 'T', body: 'B' });

    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: SUB_A.id } });
  });
});

describe('notifyOrderCustomer', () => {
  it('READY : message « prête » avec lien vers la page de suivi', async () => {
    notifyOrderCustomer('order-1', 'READY');
    await flush();

    const [, rawPayload] = mockSend.mock.calls[0];
    const payload = JSON.parse(rawPayload as string);
    expect(payload.title).toMatch(/prête/i);
    expect(payload.url).toBe('/commande/order-1');
    expect(payload.tag).toBe('order-status-order-1');
    expect(mockRemoveForOrder).not.toHaveBeenCalled();
  });

  it('COMPLETED : dernière notification puis désabonnement de la commande', async () => {
    notifyOrderCustomer('order-1', 'COMPLETED');
    await flush();

    expect(mockSend).toHaveBeenCalled();
    expect(mockRemoveForOrder).toHaveBeenCalledWith('order-1');
  });

  it('PAYMENT_PREPARING : paiement validé + départ en cuisine fusionnés', async () => {
    notifyOrderCustomer('order-1', 'PAYMENT_PREPARING');
    await flush();

    const [, rawPayload] = mockSend.mock.calls[0];
    const payload = JSON.parse(rawPayload as string);
    expect(payload.title).toMatch(/paiement validé/i);
    expect(payload.body).toMatch(/préparation/i);
  });
});
