// app/api/commandes/route.online-payment.test.ts
//
// POST /api/commandes avec le paiement en ligne (Jèko).
//   - Jèko configuré : la commande est créée EN ATTENTE, puis le paiement démarre
//     et la réponse porte l'URL de paiement vers laquelle rediriger le client.
//   - Jèko absent : comportement historique inchangé (rollout progressif).
//   - Si Jèko tombe APRÈS la création, la commande existe : on répond 201 sans URL
//     pour que le client arrive sur la page de suivi, où « Réessayer » est possible.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/email', () => ({ sendNewOrderEmail: vi.fn() }));
vi.mock('@/lib/order-create-rate-limit', () => ({
  allowOrderCreate: vi.fn(() => true),
  orderCreateRateKey: vi.fn(() => 'test'),
}));
vi.mock('@/lib/jeko/config', () => ({
  jekoConfig: vi.fn(),
  onlineFeePercent: vi.fn(() => 1),
}));
vi.mock('@/lib/menu', () => ({ getMenuAdmin: vi.fn() }));
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://eba-coffee.com' }));
vi.mock('@/lib/jeko/expiry', () => ({ expirePendingOrders: vi.fn() }));
vi.mock('@/lib/jeko/start-payment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jeko/start-payment')>()),
  startJekoPayment: vi.fn(),
}));
vi.mock('@/lib/orders', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/orders')>()),
  createOrder: vi.fn(),
}));

import { sendNewOrderEmail } from '@/lib/email';
import { jekoConfig } from '@/lib/jeko/config';
import { getMenuAdmin } from '@/lib/menu';
import { startJekoPayment } from '@/lib/jeko/start-payment';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { JekoApiError } from '@/lib/jeko/client';
import { CartMismatchError } from '@/lib/orders/cart-verification';
import { createOrder } from '@/lib/orders';
import { POST } from './route';

const create = vi.mocked(createOrder);
const start = vi.mocked(startJekoPayment);
const config = vi.mocked(jekoConfig);
const expire = vi.mocked(expirePendingOrders);
const email = vi.mocked(sendNewOrderEmail);

const jeko = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };
const menu = [{ products: [] }] as never;

const body = {
  customerName: 'Kofi Yao',
  customerPhone: '07001234',
  pickupTime: new Date(Date.now() + 3_600_000).toISOString(),
  items: [
    {
      cartId: 'c1',
      productId: 'prod-1',
      productName: 'Cappuccino',
      basePrice: 3500,
      quantity: 1,
      supplements: [],
    },
  ],
  total: 3500,
};

const expiresAt = new Date(Date.now() + 15 * 60_000);
const pendingOrder = {
  id: 'o1',
  reference: 'EBA-20261003-AB12',
  items: body.items,
  total: 3500,
  paymentExpiresAt: expiresAt,
};

function post(payload: unknown) {
  return POST(
    new NextRequest('http://localhost/api/commandes', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

describe('POST /api/commandes — paiement en ligne', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    config.mockReturnValue(jeko);
    expire.mockResolvedValue({ expired: 0, settled: 0, skipped: 0 });
    vi.mocked(getMenuAdmin).mockResolvedValue(menu);
    create.mockResolvedValue(pendingOrder as never);
    email.mockResolvedValue(undefined);
    start.mockResolvedValue({
      redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
      expiresAt,
    });
  });

  it('crée la commande en attente, démarre le paiement et renvoie l’URL', async () => {
    const res = await post({ ...body, paymentMethod: 'wave' });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: 'o1',
      reference: 'EBA-20261003-AB12',
      paymentUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
      expiresAt: expiresAt.toISOString(),
    });

    const [, opts] = create.mock.calls[0];
    expect(opts?.onlinePayment).toMatchObject({ feePercent: 1, menu });
    const delay = opts!.onlinePayment!.expiresAt.getTime() - Date.now();
    expect(delay).toBeGreaterThan(2 * 60_000);
    expect(delay).toBeLessThanOrEqual(3 * 60_000);

    expect(start).toHaveBeenCalledWith({
      orderId: 'o1',
      paymentMethod: 'wave',
      config: jeko,
      siteUrl: 'https://eba-coffee.com',
    });
  });

  it("n'écrit rien sans moyen de paiement ou avec un moyen inconnu", async () => {
    expect((await post(body)).status).toBe(400);
    expect((await post({ ...body, paymentMethod: 'bitcoin' })).status).toBe(
      400
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("n'envoie pas le courriel propriétaire pour une commande qui attend son paiement", async () => {
    await post({ ...body, paymentMethod: 'wave' });
    expect(email).not.toHaveBeenCalled();
  });

  it("ne démarre aucun paiement quand la commande n'a rien à payer, et prévient le propriétaire", async () => {
    create.mockResolvedValue({
      ...pendingOrder,
      paymentExpiresAt: null,
    } as never);

    const res = await post({ ...body, paymentMethod: 'wave' });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'o1', paymentUrl: null });
    expect(start).not.toHaveBeenCalled();
    expect(email).toHaveBeenCalledTimes(1);
  });

  it('répond 201 sans URL si Jèko tombe après la création, pour que le client puisse réessayer', async () => {
    start.mockRejectedValue(new JekoApiError(500, 'server_error', 'panne'));

    const res = await post({ ...body, paymentMethod: 'wave' });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      id: 'o1',
      paymentUrl: null,
      paymentError: 'PAYMENT_PROVIDER_ERROR',
    });
  });

  it('nettoie au passage les commandes expirées (pas de cron), sans que la réponse en dépende', async () => {
    expire.mockRejectedValue(new Error('base indisponible'));

    const res = await post({ ...body, paymentMethod: 'wave' });

    expect(expire).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });

  it('un total falsifié → 409 CART_CHANGED', async () => {
    create.mockRejectedValue(
      new CartMismatchError(
        'total_mismatch',
        'Total reçu 1 F ≠ total calculé 3500 F'
      )
    );

    const res = await post({ ...body, total: 1, paymentMethod: 'wave' });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'CART_CHANGED' });
  });
});

describe('POST /api/commandes — Jèko non configuré', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.mockReturnValue(null);
    expire.mockResolvedValue({ expired: 0, settled: 0, skipped: 0 });
    create.mockResolvedValue({
      ...pendingOrder,
      paymentExpiresAt: null,
    } as never);
    email.mockResolvedValue(undefined);
  });

  it('garde le comportement historique : pas de paiement, pas de moyen exigé', async () => {
    const res = await post(body);

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ id: 'o1', paymentUrl: null });
    expect(create.mock.calls[0][1]).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
    expect(email).toHaveBeenCalledTimes(1);
  });
});
