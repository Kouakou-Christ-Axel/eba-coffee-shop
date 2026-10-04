// app/api/commandes/[id]/paiement/verifier/route.test.ts
//
// POST /api/commandes/:id/paiement/verifier — le client est de retour de chez Jèko :
// on lit la demande et on règle la commande sans attendre le webhook. Aucune
// donnée du navigateur n'est crue : seul l'identifiant de commande compte.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ default: {} }));
vi.mock('@/lib/jeko/config', () => ({ jekoConfig: vi.fn() }));
vi.mock('@/lib/order-payment-rate-limit', () => ({
  allowPaymentStart: vi.fn(() => true),
  allowPaymentVerify: vi.fn(() => true),
  paymentRateKey: vi.fn(() => 'k'),
}));
vi.mock('@/lib/jeko/reconcile', () => ({ reconcileOrderPayment: vi.fn() }));

import { jekoConfig } from '@/lib/jeko/config';
import { reconcileOrderPayment } from '@/lib/jeko/reconcile';
import { allowPaymentVerify } from '@/lib/order-payment-rate-limit';
import { PaymentNotPendingError } from '@/lib/jeko/start-payment';
import { POST } from './route';

const reconcile = vi.mocked(reconcileOrderPayment);
const config = vi.mocked(jekoConfig);
const jeko = { apiKey: 'k', apiKeyId: 'i', storeId: 's' };

function post() {
  return POST(new Request('http://localhost/x', { method: 'POST' }), {
    params: Promise.resolve({ id: 'o1' }),
  });
}

describe('POST /api/commandes/:id/paiement/verifier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(allowPaymentVerify).mockReturnValue(true);
    config.mockReturnValue(jeko);
    reconcile.mockResolvedValue({ status: 'success', errorReason: null });
  });

  it('vérifie auprès de Jèko et renvoie le statut', async () => {
    const res = await post();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'success', errorReason: null });
    expect(reconcile).toHaveBeenCalledWith('o1', jeko);
  });

  it("transmet la raison d'un échec de paiement", async () => {
    reconcile.mockResolvedValue({
      status: 'error',
      errorReason: 'insufficient_balance',
    });
    expect(await (await post()).json()).toEqual({
      status: 'error',
      errorReason: 'insufficient_balance',
    });
  });

  it('limite le débit par commande (429)', async () => {
    vi.mocked(allowPaymentVerify).mockReturnValue(false);
    expect((await post()).status).toBe(429);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("répond 503 quand le paiement en ligne n'est pas configuré", async () => {
    config.mockReturnValue(null);
    expect((await post()).status).toBe(503);
  });

  it('répond 409 quand la commande n’a aucune demande de paiement', async () => {
    reconcile.mockRejectedValue(new PaymentNotPendingError('not_online'));
    const res = await post();
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ reason: 'not_online' });
  });

  it('répond 404 pour une commande introuvable', async () => {
    reconcile.mockRejectedValue(new PaymentNotPendingError('not_found'));
    expect((await post()).status).toBe(404);
  });
});
