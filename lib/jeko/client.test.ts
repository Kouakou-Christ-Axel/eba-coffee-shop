import { describe, expect, it, vi } from 'vitest';
import { JekoApiError, createJekoPaymentRequest } from './client';
import { config, input, json } from './client.test-utils';

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
