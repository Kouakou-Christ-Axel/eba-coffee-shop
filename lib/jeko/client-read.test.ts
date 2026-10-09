import { describe, expect, it, vi } from 'vitest';
import { getJekoPaymentRequest } from './client';
import { config, json } from './client.test-utils';

describe('getJekoPaymentRequest', () => {
  it("lit la demande par son identifiant avec l'authentification", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ id: 'pr_1', status: 'pending' }));

    await getJekoPaymentRequest(config, 'pr_1', fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(
      'https://api.jeko.africa/partner_api/payment_requests/pr_1'
    );
    expect(init.headers).toMatchObject({
      'X-API-KEY': 'key',
      'X-API-KEY-ID': 'key-id',
    });
  });

  it('convertit les frais réellement prélevés de centimes en FCFA', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'pr_1',
        status: 'success',
        transaction: {
          id: 'tx_1',
          status: 'success',
          amount: { amount: 348500, currency: 'XOF' },
          fees: { amount: 5228, currency: 'XOF' },
        },
      })
    );

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).resolves.toMatchObject({
      status: 'success',
      transactionId: 'tx_1',
      amountFcfa: 3485,
      gatewayFeeFcfa: 52.28,
    });
  });

  it('renvoie la référence et le moyen de paiement utilisé', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'pr_1',
        status: 'success',
        reference: 'EBA-20261003-AB12-1',
        paymentMethod: 'mtn',
      })
    );

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).resolves.toMatchObject({
      reference: 'EBA-20261003-AB12-1',
      paymentMethod: 'mtn',
    });
  });

  it("renvoie des frais nuls quand il n'y a pas encore de transaction", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ id: 'pr_1', status: 'pending' }));

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).resolves.toMatchObject({
      status: 'pending',
      transactionId: null,
      amountFcfa: null,
      gatewayFeeFcfa: null,
    });
  });

  it('transmet la raison de l’échec', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'pr_1',
        status: 'error',
        errorReason: 'insufficient_balance',
      })
    );

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).resolves.toMatchObject({
      status: 'error',
      errorReason: 'insufficient_balance',
    });
  });
});
