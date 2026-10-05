// scripts/jeko-mock/server.test.ts
//
// Le serveur Jèko FACTICE sert à tester le paiement en local sans argent réel
// (Jèko n'a pas de sandbox). On s'appuie dessus pour valider tout le reste : on
// le teste donc avec le VRAI client Jèko et la VRAIE vérification de signature du
// projet, sur de vrais ports. S'il dévie du contrat documenté, ces tests le disent.

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  JekoApiError,
  createJekoPaymentRequest,
  getJekoPaymentRequest,
} from '@/lib/jeko/client';
import { verifyJekoSignature } from '@/lib/jeko/signature';
import { parseJekoTransaction } from '@/lib/jeko/webhook-payload';
import { createJekoMock } from './server';

const SECRET = 'whsec_local';
const creds = { apiKey: 'local-key', apiKeyId: 'local-key-id' };

type Received = { raw: string; signature: string | undefined };

let mock: Awaited<ReturnType<typeof createJekoMock>>;
let target: Server;
let received: Received[];
let config: {
  apiKey: string;
  apiKeyId: string;
  storeId: string;
  baseUrl: string;
};

const listen = (server: Server) =>
  new Promise<number>((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve((server.address() as AddressInfo).port)
    )
  );

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

const input = {
  reference: 'EBA-20261003-AB12-1',
  amountFcfa: 3485,
  paymentMethod: 'wave' as const,
  successUrl: 'http://localhost:3000/commande/o1?paiement=ok',
  errorUrl: 'http://localhost:3000/commande/o1?paiement=echec',
};

async function act(redirectUrl: string, action: string) {
  const id = redirectUrl.split('/').pop()!;
  return fetch(`${new URL(redirectUrl).origin}/pay/${id}/${action}`, {
    method: 'POST',
    redirect: 'manual',
  });
}

describe('serveur Jèko factice', () => {
  beforeEach(async () => {
    received = [];
    target = createServer(async (req, res) => {
      received.push({
        raw: await readBody(req),
        signature: req.headers['jeko-signature'] as string | undefined,
      });
      res.writeHead(200).end('ok');
    });
    const targetPort = await listen(target);

    mock = await createJekoMock({
      ...creds,
      webhookSecret: SECRET,
      webhookUrl: `http://127.0.0.1:${targetPort}/api/webhooks/jeko`,
      port: 0,
    });
    config = {
      ...creds,
      storeId: '59ae202a-f583-4a15-970f-9e99bd1e0baa',
      baseUrl: mock.baseUrl,
    };
  });

  afterEach(async () => {
    await mock.close();
    await new Promise((r) => target.close(r));
  });

  it('accepte une demande du vrai client et renvoie une page de paiement', async () => {
    const created = await createJekoPaymentRequest(config, input);

    expect(created.status).toBe('pending');
    expect(created.redirectUrl).toMatch(
      new RegExp(`^${mock.baseUrl}/pay/[0-9a-f-]{36}$`)
    );
    const page = await (await fetch(created.redirectUrl)).text();
    expect(page).toContain('3 485');
    expect(page).toContain('wave');
  });

  it('rend le statut pending tant que personne ne paie', async () => {
    const created = await createJekoPaymentRequest(config, input);
    const read = await getJekoPaymentRequest(config, created.id);

    expect(read).toMatchObject({
      status: 'pending',
      reference: input.reference,
      transactionId: null,
    });
  });

  it('« Payer » : webhook signé que la vraie vérification accepte, puis retour au site', async () => {
    const created = await createJekoPaymentRequest(config, input);

    const res = await act(created.redirectUrl, 'pay');

    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(input.successUrl);

    expect(received).toHaveLength(1);
    const { raw, signature } = received[0];
    expect(verifyJekoSignature(raw, signature ?? null, SECRET)).toBe(true);
    expect(parseJekoTransaction(JSON.parse(raw))).toMatchObject({
      status: 'success',
      reference: input.reference,
      amountFcfa: 3485,
      paymentMethod: 'wave',
      paymentRequestId: created.id,
    });
  });

  it('prélève 1,5 % de frais, comme Jèko Checkout', async () => {
    const created = await createJekoPaymentRequest(config, input);
    await act(created.redirectUrl, 'pay');

    const read = await getJekoPaymentRequest(config, created.id);

    expect(read).toMatchObject({
      status: 'success',
      amountFcfa: 3485,
      gatewayFeeFcfa: 52.28,
    });
    expect(read.transactionId).toEqual(expect.any(String));
  });

  it('« Payer sans webhook » : succès lisible par GET, aucun webhook (teste la réconciliation)', async () => {
    const created = await createJekoPaymentRequest(config, input);

    const res = await act(created.redirectUrl, 'pay-silent');

    expect(res.headers.get('location')).toBe(input.successUrl);
    expect(received).toHaveLength(0);
    expect((await getJekoPaymentRequest(config, created.id)).status).toBe(
      'success'
    );
  });

  it('« Échouer » : statut error avec raison, retour sur errorUrl, aucun webhook', async () => {
    const created = await createJekoPaymentRequest(config, input);

    const res = await act(created.redirectUrl, 'fail');

    expect(res.headers.get('location')).toBe(input.errorUrl);
    expect(received).toHaveLength(0);
    expect(await getJekoPaymentRequest(config, created.id)).toMatchObject({
      status: 'error',
      errorReason: 'insufficient_balance',
    });
  });

  it('« Quitter sans payer » ne change rien : la demande reste en attente', async () => {
    const created = await createJekoPaymentRequest(config, input);

    await act(created.redirectUrl, 'abandon');

    expect((await getJekoPaymentRequest(config, created.id)).status).toBe(
      'pending'
    );
    expect(received).toHaveLength(0);
  });

  it('refuse de payer deux fois la même demande', async () => {
    const created = await createJekoPaymentRequest(config, input);
    await act(created.redirectUrl, 'pay');

    await act(created.redirectUrl, 'pay');

    expect(received).toHaveLength(1);
  });

  it('refuse une clé API invalide (401)', async () => {
    await expect(
      createJekoPaymentRequest({ ...config, apiKey: 'mauvaise' }, input)
    ).rejects.toMatchObject({ status: 401 });
  });

  it('refuse une référence déjà utilisée (409), comme Jèko', async () => {
    await createJekoPaymentRequest(config, input);

    await expect(createJekoPaymentRequest(config, input)).rejects.toMatchObject(
      {
        status: 409,
        code: 'payment_request_exists_with_reference',
      }
    );
  });

  it("refuse un montant qui n'est pas un multiple de 100 centimes (422)", async () => {
    const res = await fetch(`${mock.baseUrl}/partner_api/payment_requests`, {
      method: 'POST',
      headers: {
        'X-API-KEY': creds.apiKey,
        'X-API-KEY-ID': creds.apiKeyId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        storeId: config.storeId,
        amountCents: 150,
        currency: 'XOF',
        reference: 'EBA-20261003-ZZ99-1',
        paymentDetails: {
          type: 'redirect',
          data: {
            paymentMethod: 'wave',
            successUrl: input.successUrl,
            errorUrl: input.errorUrl,
          },
        },
      }),
    });
    expect(res.status).toBe(422);
  });

  it('renvoie 404 pour une demande inconnue', async () => {
    await expect(
      getJekoPaymentRequest(config, 'inconnue')
    ).rejects.toBeInstanceOf(JekoApiError);
  });
});
