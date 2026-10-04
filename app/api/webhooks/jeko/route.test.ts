// app/api/webhooks/jeko/route.test.ts
//
// Webhook Jèko. Règles : secret absent = route inerte (404) ; signature vérifiée
// sur le corps BRUT avant toute lecture ; une transaction qui n'est pas un de nos
// paiements est acquittée (200) sans rien faire, sinon Jèko réessaierait ; une
// erreur de traitement répond 500 pour que Jèko réessaie (jusqu'à 3 livraisons).

import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/jeko/config', () => ({ jekoWebhookSecret: vi.fn() }));
vi.mock('@/lib/jeko/settle', () => ({ settleJekoTransaction: vi.fn() }));
vi.mock('@/lib/jeko/expiry', () => ({ expirePendingOrders: vi.fn() }));

import { jekoWebhookSecret } from '@/lib/jeko/config';
import { settleJekoTransaction } from '@/lib/jeko/settle';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { POST } from './route';

const SECRET = 'whsec_test';
const secret = vi.mocked(jekoWebhookSecret);
const settle = vi.mocked(settleJekoTransaction);
const expire = vi.mocked(expirePendingOrders);

const payment = {
  id: 'txn_1',
  amount: { amount: 348500, currency: 'XOF' },
  fees: { amount: 5228, currency: 'XOF' },
  status: 'success',
  paymentMethod: 'wave',
  transactionType: 'payment',
  transactionDetails: { id: 'pr_1', reference: 'EBA-20261003-AB12-1' },
};

const sign = (raw: string) =>
  createHmac('sha256', SECRET).update(raw).digest('hex');

function call(raw: string, signature: string | null = sign(raw)) {
  return POST(
    new Request('http://localhost/api/webhooks/jeko', {
      method: 'POST',
      body: raw,
      headers: signature ? { 'Jeko-Signature': signature } : {},
    })
  );
}

describe('POST /api/webhooks/jeko', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    secret.mockReturnValue(SECRET);
    settle.mockResolvedValue('paid');
    expire.mockResolvedValue({ expired: 0, settled: 0, skipped: 0 });
  });

  it("est inerte (404) quand le secret n'est pas configuré", async () => {
    secret.mockReturnValue('');
    const res = await call(JSON.stringify(payment));
    expect(res.status).toBe(404);
    expect(settle).not.toHaveBeenCalled();
  });

  it('refuse (401) une signature absente ou invalide, sans rien traiter', async () => {
    const raw = JSON.stringify(payment);
    expect((await call(raw, null)).status).toBe(401);
    expect((await call(raw, 'a'.repeat(64))).status).toBe(401);
    expect(settle).not.toHaveBeenCalled();
  });

  it('vérifie la signature sur le corps brut, pas sur un JSON re-sérialisé', async () => {
    // Espaces et sauts de ligne : JSON.stringify(JSON.parse(raw)) ≠ raw.
    const raw = `{\n  "id": "txn_1",  "amount": {"amount": 348500, "currency": "XOF"},\n "status": "success", "transactionType": "payment",\n "paymentMethod": "wave",\n "transactionDetails": {"reference": "EBA-20261003-AB12-1"} }`;
    const res = await call(raw);
    expect(res.status).toBe(200);
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it('règle un paiement signé et répond 200', async () => {
    const res = await call(JSON.stringify(payment));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outcome: 'paid' });
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'EBA-20261003-AB12-1',
        amountFcfa: 3485,
        paymentMethod: 'wave',
      })
    );
  });

  it('acquitte (200) un reversement ou une transaction sans référence, sans la régler', async () => {
    const transfer = JSON.stringify({
      ...payment,
      transactionType: 'transfer',
    });
    expect((await call(transfer)).status).toBe(200);
    expect(settle).not.toHaveBeenCalled();
  });

  it("lance l'expiration opportuniste après un paiement, sans que la réponse en dépende", async () => {
    expire.mockRejectedValue(new Error('base indisponible'));

    const res = await call(JSON.stringify(payment));

    expect(expire).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });

  it("n'expire rien pour une requête non signée", async () => {
    await call(JSON.stringify(payment), null);
    expect(expire).not.toHaveBeenCalled();
  });

  it("refuse (400) un corps signé qui n'est pas du JSON", async () => {
    expect((await call('pas du json')).status).toBe(400);
    expect(settle).not.toHaveBeenCalled();
  });

  it('répond 500 quand le règlement échoue, pour que Jèko réessaie', async () => {
    settle.mockRejectedValue(new Error('base indisponible'));
    const res = await call(JSON.stringify(payment));
    expect(res.status).toBe(500);
  });
});
