// lib/jeko/client.ts
//
// Client minimal de l'API Partner Jèko : création et lecture d'une demande de
// paiement (Checkout, mode `redirect`). La config est passée en paramètre et le
// `fetch` est injectable : ce module reste pur et testable hors runtime Next
// (`ENV` de varlock n'y est pas peuplée — cf. lib/site-url.ts). La lecture de
// l'env se fait dans `lib/jeko/config.ts`.
//
// Unités : l'API compte en centimes (`amountCents` = FCFA × 100, multiple de
// 100). Tout le reste du code applicatif raisonne en FCFA entiers.

import type { JekoPaymentMethod } from './payment-methods';

const DEFAULT_BASE_URL = 'https://api.jeko.africa';
export const CENTS_PER_FCFA = 100;
const REFERENCE_MIN = 5;
const REFERENCE_MAX = 100;

export type JekoConfig = {
  apiKey: string;
  apiKeyId: string;
  storeId: string;
  /** Absent = production. Sert à viser le serveur factice en local. */
  baseUrl?: string;
};

function baseUrl(config: JekoConfig): string {
  return (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export type { JekoPaymentMethod } from './payment-methods';

export type JekoStatus = 'pending' | 'success' | 'error';

export type CreatePaymentRequestInput = {
  reference: string;
  amountFcfa: number;
  paymentMethod: JekoPaymentMethod;
  successUrl: string;
  errorUrl: string;
};

type FetchFn = typeof fetch;

export class JekoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'JekoApiError';
  }
}

// Un Jèko qui ne répond pas ne doit pas bloquer la page du client indéfiniment.
const REQUEST_TIMEOUT_MS = 10_000;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * HTTPS exigé par Jèko pour les URLs de retour. Seule exception : http sur
 * localhost, pour tester en local avec le serveur factice. On compare le nom
 * d'hôte EXACT analysé par `URL`, pas une sous-chaîne (`localhost.evil.com`).
 */
function isAllowedReturnUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))
    );
  } catch {
    return false;
  }
}

function authHeaders(config: JekoConfig): Record<string, string> {
  return { 'X-API-KEY': config.apiKey, 'X-API-KEY-ID': config.apiKeyId };
}

/**
 * Appel HTTP borné par un délai. Un échec réseau (liens instables, Jèko
 * injoignable) devient une `JekoApiError` identifiable : sans cela il remonterait
 * comme une erreur brute et serait pris pour une panne de NOTRE serveur.
 */
async function call(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetchFn(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new JekoApiError(504, 'timeout', 'Jèko ne répond pas');
    }
    throw new JekoApiError(
      503,
      'network_error',
      err instanceof Error ? err.message : 'Jèko injoignable'
    );
  }
}

// 422 : `extras.errors` dit QUEL champ est refusé et pourquoi. Sans lui, le
// journal ne montre qu'un « 422 » inexploitable.
function validationDetail(body: Record<string, unknown>): string {
  const extras = body.extras as { errors?: unknown } | undefined;
  if (!Array.isArray(extras?.errors)) return '';
  return extras.errors
    .map((e: { field?: string; rule?: string; message?: string }) =>
      [e.field, e.rule, e.message].filter(Boolean).join(' ')
    )
    .join('; ');
}

async function parseOrThrow(res: Response): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new JekoApiError(
      res.status,
      typeof body.id === 'string' ? body.id : 'unknown',
      [
        typeof body.message === 'string'
          ? body.message
          : `Jèko a répondu ${res.status}`,
        validationDetail(body),
      ]
        .filter(Boolean)
        .join(' — ')
    );
  }
  return body;
}

export async function createJekoPaymentRequest(
  config: JekoConfig,
  input: CreatePaymentRequestInput,
  fetchFn: FetchFn = fetch
): Promise<{ id: string; status: JekoStatus; redirectUrl: string }> {
  const { reference, amountFcfa, paymentMethod, successUrl, errorUrl } = input;

  if (reference.length < REFERENCE_MIN || reference.length > REFERENCE_MAX) {
    throw new Error(
      `Référence Jèko invalide : ${REFERENCE_MIN} à ${REFERENCE_MAX} caractères`
    );
  }
  if (!Number.isInteger(amountFcfa) || amountFcfa <= 0) {
    throw new Error(`Montant Jèko invalide : ${amountFcfa}`);
  }
  for (const url of [successUrl, errorUrl]) {
    if (!isAllowedReturnUrl(url)) {
      throw new Error(`URL de retour Jèko non HTTPS : ${url}`);
    }
  }

  const res = await call(
    fetchFn,
    `${baseUrl(config)}/partner_api/payment_requests`,
    {
      method: 'POST',
      headers: { ...authHeaders(config), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: config.storeId,
        amountCents: amountFcfa * CENTS_PER_FCFA,
        currency: 'XOF',
        reference,
        paymentDetails: {
          type: 'redirect',
          data: { paymentMethod, successUrl, errorUrl },
        },
      }),
    }
  );
  const body = await parseOrThrow(res);

  return {
    id: body.id as string,
    status: body.status as JekoStatus,
    redirectUrl: body.redirectUrl as string,
  };
}

type TransactionBody = {
  id: string;
  amount: { amount: number };
  fees: { amount: number };
};

export async function getJekoPaymentRequest(
  config: JekoConfig,
  id: string,
  fetchFn: FetchFn = fetch
): Promise<{
  id: string;
  status: JekoStatus;
  reference: string | null;
  paymentMethod: string | null;
  errorReason: string | null;
  transactionId: string | null;
  amountFcfa: number | null;
  gatewayFeeFcfa: number | null;
}> {
  const res = await call(
    fetchFn,
    `${baseUrl(config)}/partner_api/payment_requests/${encodeURIComponent(id)}`,
    { headers: authHeaders(config) }
  );
  const body = await parseOrThrow(res);
  const tx = (body.transaction ?? null) as TransactionBody | null;

  return {
    id: body.id as string,
    status: body.status as JekoStatus,
    reference: (body.reference as string | undefined) ?? null,
    paymentMethod: (body.paymentMethod as string | undefined) ?? null,
    errorReason: (body.errorReason as string | null | undefined) ?? null,
    transactionId: tx?.id ?? null,
    amountFcfa: tx ? tx.amount.amount / CENTS_PER_FCFA : null,
    gatewayFeeFcfa: tx ? tx.fees.amount / CENTS_PER_FCFA : null,
  };
}
