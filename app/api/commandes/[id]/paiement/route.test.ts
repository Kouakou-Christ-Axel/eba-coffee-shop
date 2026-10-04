// app/api/commandes/[id]/paiement/route.test.ts
//
// POST /api/commandes/:id/paiement — démarrer ou RELANCER le paiement d'une
// commande en attente (« Réessayer » après un échec, ou autre moyen de paiement).
// Le montant n'est jamais fourni par le navigateur : il est relu en base.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/jeko/config', () => ({ jekoConfig: vi.fn() }));
vi.mock('@/lib/site-url', () => ({ siteUrl: () => 'https://eba-coffee.com' }));
vi.mock('@/lib/order-payment-rate-limit', () => ({
  allowPaymentStart: vi.fn(() => true),
  allowPaymentVerify: vi.fn(() => true),
  paymentRateKey: vi.fn(() => 'k'),
}));
vi.mock('@/lib/jeko/start-payment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/jeko/start-payment')>()),
  startJekoPayment: vi.fn(),
}));

import { jekoConfig } from '@/lib/jeko/config';
import { allowPaymentStart } from '@/lib/order-payment-rate-limit';
import { JekoApiError } from '@/lib/jeko/client';
import {
  PaymentNotPendingError,
  startJekoPayment,
} from '@/lib/jeko/start-payment';
import { POST } from './route';

const start = vi.mocked(startJekoPayment);
const config = vi.mocked(jekoConfig);
const jeko = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };
const expiresAt = new Date('2026-10-03T12:15:00.000Z');

function post(payload: unknown) {
  return POST(
    new Request('http://localhost/api/commandes/o1/paiement', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id: 'o1' }) }
  );
}

describe('POST /api/commandes/:id/paiement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(allowPaymentStart).mockReturnValue(true);
    config.mockReturnValue(jeko);
    start.mockResolvedValue({
      redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_2',
      expiresAt,
    });
  });

  it("relance le paiement et renvoie l'URL et la nouvelle échéance", async () => {
    const res = await post({ paymentMethod: 'orange' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      paymentUrl: 'https://pay.jeko.africa/pay_request/pr/pr_2',
      expiresAt: expiresAt.toISOString(),
    });
    expect(start).toHaveBeenCalledWith({
      orderId: 'o1',
      paymentMethod: 'orange',
      config: jeko,
      siteUrl: 'https://eba-coffee.com',
    });
  });

  it('refuse un moyen de paiement absent ou inconnu', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ paymentMethod: 'bitcoin' })).status).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });

  it('refuse un corps qui n’est pas du JSON', async () => {
    const res = await POST(
      new Request('http://localhost/x', {
        method: 'POST',
        body: 'pas du json',
      }),
      { params: Promise.resolve({ id: 'o1' }) }
    );
    expect(res.status).toBe(400);
  });

  it('limite le débit par commande (429)', async () => {
    vi.mocked(allowPaymentStart).mockReturnValue(false);
    const res = await post({ paymentMethod: 'wave' });
    expect(res.status).toBe(429);
    expect(start).not.toHaveBeenCalled();
  });

  it("répond 503 quand le paiement en ligne n'est pas configuré", async () => {
    config.mockReturnValue(null);
    const res = await post({ paymentMethod: 'wave' });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('PAYMENT_PROVIDER_ERROR');
  });

  it('répond 409 avec la raison quand la commande ne peut plus être payée', async () => {
    start.mockRejectedValue(new PaymentNotPendingError('expired'));
    const res = await post({ paymentMethod: 'wave' });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'CONFLICT',
      reason: 'expired',
    });
  });

  it('répond 502 quand Jèko échoue, sans exposer son détail', async () => {
    start.mockRejectedValue(
      new JekoApiError(401, 'unauthorized', 'clé révoquée')
    );
    const res = await post({ paymentMethod: 'wave' });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('révoquée');
  });
});
