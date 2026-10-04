// scripts/jeko-mock/server.ts
//
// Serveur Jèko FACTICE, pour tester le paiement en ligne en local sans argent réel
// (Jèko n'a pas de sandbox). Il imite le contrat documenté de Jèko Checkout :
//   POST /partner_api/payment_requests      → crée une demande, renvoie redirectUrl
//   GET  /partner_api/payment_requests/:id  → statut (+ transaction et frais)
//   GET  /pay/:id                           → page de paiement factice
//   POST /pay/:id/{pay,pay-silent,fail,abandon}  → les gestes du « client »
// et envoie, comme Jèko, un webhook `TRANSACTION_COMPLETED` signé (HMAC-SHA256 du
// corps brut) à l'application. Ce n'est PAS un banc d'essai exhaustif de Jèko :
// juste assez de comportement pour rejouer le parcours complet.

import { createHmac, randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

const SUPPORTED_METHODS = ['wave', 'orange', 'mtn', 'moov', 'djamo', 'jeko'];
// Jèko Checkout prélève 1,5 % (page Tarifs de la doc).
const FEE_RATE = 0.015;

export type JekoMockOptions = {
  apiKey: string;
  apiKeyId: string;
  /** Secret qui signe les webhooks envoyés à l'application. */
  webhookSecret: string;
  /** URL du webhook de l'application, ex. http://localhost:3000/api/webhooks/jeko */
  webhookUrl: string;
  port: number;
  host?: string;
};

type PaymentRequest = {
  id: string;
  storeId: string;
  reference: string;
  amountCents: number;
  paymentMethod: string;
  status: 'pending' | 'success' | 'error';
  errorReason: string | null;
  successUrl: string;
  errorUrl: string;
  transactionId: string | null;
  executedAt: string | null;
};

const fcfa = (cents: number) =>
  String(cents / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const apiError = (
  res: ServerResponse,
  status: number,
  id: string,
  message: string,
  extras?: unknown
) => sendJson(res, status, { id, message, ...(extras ? { extras } : {}) });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function paymentPage(r: PaymentRequest): string {
  const action = (name: string, label: string, hint: string) => `
    <form method="post" action="/pay/${r.id}/${name}">
      <button type="submit">${label}</button><small>${hint}</small>
    </form>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jèko (factice) — paiement</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:28rem;margin:2rem auto;padding:0 1rem;color:#222}
  .banner{background:#fff3cd;border:1px solid #e0c36a;padding:.6rem .8rem;border-radius:.5rem;font-size:.85rem}
  .amount{font-size:2rem;font-weight:700;margin:.5rem 0}
  form{margin:.9rem 0;display:flex;flex-direction:column;gap:.2rem}
  button{padding:.75rem;font-size:1rem;border-radius:.5rem;border:1px solid #888;cursor:pointer}
  small{color:#666}
</style></head><body>
<p class="banner">⚠️ Serveur Jèko <b>factice</b> (local). Aucun argent réel n'est en jeu.</p>
<h1>Paiement</h1>
<p>Référence : <code>${escapeHtml(r.reference)}</code></p>
<p class="amount">${fcfa(r.amountCents)} FCFA</p>
<p>Moyen : <b>${escapeHtml(r.paymentMethod)}</b> — statut : <b>${r.status}</b></p>
${action('pay', '✅ Payer', 'Succès : webhook signé envoyé, retour sur le site.')}
${action('pay-silent', '✅ Payer sans webhook', 'Succès lisible par l’API mais AUCUN webhook : teste la réconciliation au retour.')}
${action('fail', '❌ Échouer', 'Statut error (solde insuffisant), retour sur la page d’erreur.')}
${action('abandon', '🚪 Quitter sans payer', 'Rien ne change : la commande attendra jusqu’à son expiration.')}
</body></html>`;
}

export async function createJekoMock(options: JekoMockOptions): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const requests = new Map<string, PaymentRequest>();
  const references = new Set<string>();
  const host = options.host ?? '127.0.0.1';
  let baseUrl = '';

  const authorized = (req: IncomingMessage) =>
    req.headers['x-api-key'] === options.apiKey &&
    req.headers['x-api-key-id'] === options.apiKeyId;

  function view(r: PaymentRequest) {
    return {
      id: r.id,
      storeId: r.storeId,
      reference: r.reference,
      type: 'redirect',
      paymentMethod: r.paymentMethod,
      status: r.status,
      errorReason: r.errorReason,
      redirectUrl: `${baseUrl}/pay/${r.id}`,
      transaction:
        r.status === 'success'
          ? {
              id: r.transactionId,
              amount: { amount: r.amountCents, currency: 'XOF' },
              fees: {
                amount: Math.round(r.amountCents * FEE_RATE),
                currency: 'XOF',
              },
              status: 'success',
              counterpartLabel: 'Client factice',
              counterpartIdentifier: '+2250700000000',
              description: `Paiement ${r.reference}`,
              executedAt: r.executedAt,
            }
          : null,
    };
  }

  async function sendWebhook(r: PaymentRequest) {
    const raw = JSON.stringify({
      id: r.transactionId,
      amount: { amount: r.amountCents, currency: 'XOF' },
      fees: { amount: Math.round(r.amountCents * FEE_RATE), currency: 'XOF' },
      status: 'success',
      counterpartLabel: 'Client factice',
      counterpartIdentifier: '+2250700000000',
      paymentMethod: r.paymentMethod,
      transactionType: 'payment',
      storeId: r.storeId,
      description: `Paiement ${r.reference}`,
      executedAt: r.executedAt,
      transactionDetails: { id: r.id, reference: r.reference },
    });
    const signature = createHmac('sha256', options.webhookSecret)
      .update(raw)
      .digest('hex');
    try {
      const res = await fetch(options.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Jeko-Signature': signature,
          'Jeko-Event': 'TRANSACTION_COMPLETED',
        },
        body: raw,
      });
      console.log(`[jeko-mock] webhook ${r.reference} → ${res.status}`);
    } catch (err) {
      console.error(`[jeko-mock] webhook ${r.reference} injoignable :`, err);
    }
  }

  async function createRequest(req: IncomingMessage, res: ServerResponse) {
    if (!authorized(req)) {
      return apiError(res, 401, 'unauthorized', 'Clé API invalide');
    }
    let body: {
      storeId?: string;
      amountCents?: number;
      currency?: string;
      reference?: string;
      paymentDetails?: {
        type?: string;
        data?: {
          paymentMethod?: string;
          successUrl?: string;
          errorUrl?: string;
        };
      };
    };
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return apiError(res, 400, 'invalid_body', 'Corps invalide');
    }

    const data = body.paymentDetails?.data;
    const errors: { field: string; rule: string; message: string }[] = [];
    if (!body.storeId)
      errors.push({
        field: 'storeId',
        rule: 'required',
        message: 'storeId requis',
      });
    if (body.currency !== 'XOF')
      errors.push({ field: 'currency', rule: 'enum', message: 'XOF attendu' });
    if (
      !Number.isInteger(body.amountCents) ||
      (body.amountCents as number) < 100 ||
      (body.amountCents as number) % 100 !== 0
    ) {
      errors.push({
        field: 'amountCents',
        rule: 'multipleOf',
        message: 'Multiple de 100, minimum 100',
      });
    }
    const reference = body.reference ?? '';
    if (reference.length < 5 || reference.length > 100) {
      errors.push({
        field: 'reference',
        rule: 'length',
        message: '5 à 100 caractères',
      });
    }
    if (body.paymentDetails?.type !== 'redirect') {
      errors.push({
        field: 'paymentDetails.type',
        rule: 'enum',
        message: 'redirect attendu',
      });
    }
    if (!data?.successUrl || !data.errorUrl) {
      errors.push({
        field: 'paymentDetails.data',
        rule: 'required',
        message: 'successUrl et errorUrl requis',
      });
    }
    if (errors.length > 0) {
      return apiError(res, 422, 'validation_error', 'Requête invalide', {
        errors,
      });
    }
    if (!SUPPORTED_METHODS.includes(data?.paymentMethod ?? '')) {
      return apiError(
        res,
        404,
        'unsupported_payment_method',
        'Méthode inconnue'
      );
    }
    if (references.has(reference)) {
      return apiError(
        res,
        409,
        'payment_request_exists_with_reference',
        'Référence déjà utilisée'
      );
    }

    const request: PaymentRequest = {
      id: randomUUID(),
      storeId: body.storeId as string,
      reference,
      amountCents: body.amountCents as number,
      paymentMethod: data!.paymentMethod as string,
      status: 'pending',
      errorReason: null,
      successUrl: data!.successUrl as string,
      errorUrl: data!.errorUrl as string,
      transactionId: null,
      executedAt: null,
    };
    requests.set(request.id, request);
    references.add(reference);
    console.log(
      `[jeko-mock] demande ${reference} · ${fcfa(request.amountCents)} FCFA · ${request.paymentMethod}`
    );
    sendJson(res, 200, view(request));
  }

  async function gesture(
    r: PaymentRequest,
    action: string,
    res: ServerResponse
  ) {
    const redirect = (url: string) => {
      res.writeHead(303, { Location: url });
      res.end();
    };

    if (action === 'abandon') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(
        '<p>Vous avez quitté la page de paiement. Rien n’a changé : la commande attend toujours son paiement.</p>'
      );
    }
    // Une demande déjà réglée ou échouée ne se rejoue pas.
    if (r.status !== 'pending') {
      return redirect(r.status === 'success' ? r.successUrl : r.errorUrl);
    }
    if (action === 'fail') {
      r.status = 'error';
      r.errorReason = 'insufficient_balance';
      return redirect(r.errorUrl);
    }
    // 'pay' (avec webhook) ou 'pay-silent' (sans)
    r.status = 'success';
    r.transactionId = `txn_${randomUUID().slice(0, 8)}`;
    r.executedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    if (action === 'pay') await sendWebhook(r);
    redirect(r.successUrl);
  }

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const parts = url.pathname.split('/').filter(Boolean);

      if (
        req.method === 'POST' &&
        url.pathname === '/partner_api/payment_requests'
      ) {
        return await createRequest(req, res);
      }
      if (
        req.method === 'GET' &&
        parts[0] === 'partner_api' &&
        parts[1] === 'payment_requests' &&
        parts[2]
      ) {
        if (!authorized(req))
          return apiError(res, 401, 'unauthorized', 'Clé API invalide');
        const found = requests.get(parts[2]);
        return found
          ? sendJson(res, 200, view(found))
          : apiError(res, 404, 'not_found', 'Demande introuvable');
      }
      if (parts[0] === 'pay' && parts[1]) {
        const found = requests.get(parts[1]);
        if (!found)
          return apiError(res, 404, 'not_found', 'Demande introuvable');
        if (req.method === 'GET' && parts.length === 2) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(paymentPage(found));
        }
        if (req.method === 'POST' && parts.length === 3) {
          return await gesture(found, parts[2], res);
        }
      }
      apiError(res, 404, 'not_found', 'Route inconnue');
    } catch (err) {
      console.error('[jeko-mock] erreur :', err);
      apiError(res, 500, 'server_error', 'Erreur du serveur factice');
    }
  });

  await new Promise<void>((resolve) =>
    server.listen(options.port, host, resolve)
  );
  baseUrl = `http://${host}:${(server.address() as AddressInfo).port}`;

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
