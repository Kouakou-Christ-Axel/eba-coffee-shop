// lib/jeko/client.test.ts
//
// Client minimal de l'API Partner Jèko (création + lecture d'une demande de
// paiement). Contrat tiré de la doc : `amountCents` = FCFA × 100, référence de
// 5 à 100 caractères, `paymentMethod` obligatoire, auth par `X-API-KEY` +
// `X-API-KEY-ID`. Le `fetch` est injecté : c'est la frontière HTTP, la seule
// chose qu'on remplace.

import { describe, expect, it, vi } from 'vitest';
import {
  JekoApiError,
  createJekoPaymentRequest,
  getJekoPaymentRequest,
} from './client';

const config = {
  apiKey: 'key',
  apiKeyId: 'key-id',
  storeId: '59ae202a-f583-4a15-970f-9e99bd1e0baa',
};

const input = {
  reference: 'EBA-0012-1',
  amountFcfa: 3485,
  paymentMethod: 'wave' as const,
  successUrl: 'https://eba-coffee.com/commande/o1?paiement=ok',
  errorUrl: 'https://eba-coffee.com/commande/o1?paiement=echec',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createJekoPaymentRequest', () => {
  it('envoie la demande au bon endpoint avec les bons en-têtes et le bon corps', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'pr_1',
        status: 'pending',
        redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
      })
    );

    await createJekoPaymentRequest(config, input, fetchFn);

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.jeko.africa/partner_api/payment_requests');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'X-API-KEY': 'key',
      'X-API-KEY-ID': 'key-id',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body)).toEqual({
      storeId: config.storeId,
      amountCents: 348500,
      currency: 'XOF',
      reference: 'EBA-0012-1',
      paymentDetails: {
        type: 'redirect',
        data: {
          paymentMethod: 'wave',
          successUrl: input.successUrl,
          errorUrl: input.errorUrl,
        },
      },
    });
  });

  it("renvoie l'identifiant, le statut et l'URL de redirection", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json({
        id: 'pr_1',
        status: 'pending',
        redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
      })
    );

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).resolves.toEqual({
      id: 'pr_1',
      status: 'pending',
      redirectUrl: 'https://pay.jeko.africa/pay_request/pr/pr_1',
    });
  });

  it("lève une JekoApiError portant le statut et le code quand l'API refuse", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json(
        {
          id: 'payment_request_exists_with_reference',
          message: 'Déjà utilisée',
        },
        409
      )
    );

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toMatchObject({
      name: 'JekoApiError',
      status: 409,
      code: 'payment_request_exists_with_reference',
    });
  });

  it('met le détail de validation d’un 422 dans le message (champ + règle)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      json(
        {
          message: 'Validation failure',
          extras: {
            errors: [
              { field: 'successUrl', rule: 'url', message: 'URL invalide' },
            ],
          },
        },
        422
      )
    );

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toThrow(/successUrl.*url.*URL invalide/);
  });

  it("refuse une référence trop courte sans appeler l'API", async () => {
    const fetchFn = vi.fn();
    await expect(
      createJekoPaymentRequest(config, { ...input, reference: 'A1' }, fetchFn)
    ).rejects.toThrow(/référence/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("refuse un montant nul, négatif ou non entier sans appeler l'API", async () => {
    const fetchFn = vi.fn();
    for (const amountFcfa of [0, -5, 10.5]) {
      await expect(
        createJekoPaymentRequest(config, { ...input, amountFcfa }, fetchFn)
      ).rejects.toThrow(/montant/i);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('refuse des URLs de retour qui ne sont pas en HTTPS', async () => {
    const fetchFn = vi.fn();
    await expect(
      createJekoPaymentRequest(
        config,
        { ...input, successUrl: 'http://eba-coffee.com/ok' },
        fetchFn
      )
    ).rejects.toThrow(/https/i);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('accepte des URLs de retour http en local (localhost, 127.0.0.1)', async () => {
    // Une réponse NEUVE à chaque appel : le corps d'une `Response` ne se lit qu'une fois.
    const fetchFn = vi.fn(async () =>
      json({ id: 'pr_1', status: 'pending', redirectUrl: 'http://x/pay' })
    );

    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
      await expect(
        createJekoPaymentRequest(
          config,
          {
            ...input,
            successUrl: `${origin}/commande/o1?paiement=ok`,
            errorUrl: `${origin}/commande/o1?paiement=echec`,
          },
          fetchFn
        )
      ).resolves.toMatchObject({ id: 'pr_1' });
    }
  });

  it("refuse http pour tout autre hôte, même s'il ressemble à localhost", async () => {
    const fetchFn = vi.fn();
    for (const origin of [
      'http://eba-coffee.com',
      'http://localhost.evil.com',
      'http://evil.com/localhost',
    ]) {
      await expect(
        createJekoPaymentRequest(
          config,
          { ...input, successUrl: `${origin}/ok` },
          fetchFn
        )
      ).rejects.toThrow(/https/i);
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('est exportée avec une erreur identifiable', () => {
    expect(new JekoApiError(500, 'x', 'boom')).toBeInstanceOf(Error);
  });
});

describe('URL de base configurable', () => {
  it('cible le serveur indiqué par la config (serveur factice en local)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        json({ id: 'pr_1', status: 'pending', redirectUrl: 'http://x/pay' })
      );
    const local = { ...config, baseUrl: 'http://localhost:4010' };

    await createJekoPaymentRequest(local, input, fetchFn);
    await getJekoPaymentRequest(local, 'pr_1', fetchFn);

    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests'
    );
    expect(fetchFn.mock.calls[1][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests/pr_1'
    );
  });

  it('ignore un slash final dans la config', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ id: 'pr_1', status: 'pending' }));

    await getJekoPaymentRequest(
      { ...config, baseUrl: 'http://localhost:4010/' },
      'pr_1',
      fetchFn
    );

    expect(fetchFn.mock.calls[0][0]).toBe(
      'http://localhost:4010/partner_api/payment_requests/pr_1'
    );
  });
});

describe('pannes réseau', () => {
  it('convertit un échec réseau en JekoApiError identifiable (création)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toMatchObject({
      name: 'JekoApiError',
      status: 503,
      code: 'network_error',
    });
  });

  it('convertit un échec réseau en JekoApiError identifiable (lecture)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      getJekoPaymentRequest(config, 'pr_1', fetchFn)
    ).rejects.toMatchObject({ name: 'JekoApiError', code: 'network_error' });
  });

  it('convertit un dépassement de délai en JekoApiError « timeout »', async () => {
    const timeout = new DOMException('The operation timed out', 'TimeoutError');
    const fetchFn = vi.fn().mockRejectedValue(timeout);

    await expect(
      createJekoPaymentRequest(config, input, fetchFn)
    ).rejects.toMatchObject({ status: 504, code: 'timeout' });
  });

  it('borne chaque appel par un délai (un Jèko qui ne répond pas ne bloque pas la page)', async () => {
    const fetchFn = vi.fn(async () =>
      json({ id: 'pr_1', status: 'pending', redirectUrl: 'https://x/pay' })
    );

    await createJekoPaymentRequest(config, input, fetchFn);
    await getJekoPaymentRequest(config, 'pr_1', fetchFn);

    for (const [, init] of fetchFn.mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});

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
