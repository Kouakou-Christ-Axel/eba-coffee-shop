// Serveur Jèko FACTICE, pour tester le paiement en ligne en local sans argent
// réel (Jèko n'a pas de sandbox). Imite le contrat de Jèko Checkout :
//   POST /partner_api/payment_requests      → crée une demande, renvoie redirectUrl
//   GET  /partner_api/payment_requests/:id  → statut (+ transaction et frais)
//   GET  /pay/:id                           → page de paiement factice
//   POST /pay/:id/{pay,pay-silent,fail,abandon}  → les gestes du « client »
// et envoie un webhook `TRANSACTION_COMPLETED` signé à l'application. Pas un
// banc d'essai exhaustif : juste de quoi rejouer le parcours complet.

import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPaymentRequest } from './lib/create-request';
import { gesture } from './lib/gesture';
import { apiError, sendJson } from './lib/http';
import { paymentPage } from './lib/payment-page';
import type { JekoMockOptions, PaymentRequest } from './lib/types';
import { paymentRequestView } from './lib/view';

export type { JekoMockOptions } from './lib/types';

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

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const parts = url.pathname.split('/').filter(Boolean);

      if (
        req.method === 'POST' &&
        url.pathname === '/partner_api/payment_requests'
      ) {
        if (!authorized(req)) {
          return apiError(res, 401, 'unauthorized', 'Clé API invalide');
        }
        return await createPaymentRequest(req, res, {
          requests,
          references,
          baseUrl,
        });
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
          ? sendJson(res, 200, paymentRequestView(found, baseUrl))
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
          return await gesture(options, found, parts[2], res);
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
