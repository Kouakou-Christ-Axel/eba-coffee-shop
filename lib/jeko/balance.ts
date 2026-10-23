// lib/jeko/balance.ts
//
// Solde RÉEL d'un magasin Jèko (`GET /partner_api/stores/{storeId}/balance`), à
// comparer au solde attendu calculé par ./ledger. Comme partout dans l'API, les
// montants sont en centimes. La forme exacte de la réponse n'est pas documentée
// ici : on cherche le montant sous les clés usuelles et, à défaut, on remonte le
// JSON brut (`unknown`) pour que l'écran le montre au lieu d'inventer un chiffre.

import {
  CENTS_PER_FCFA,
  authHeaders,
  baseUrl,
  call,
  parseOrThrow,
  type FetchFn,
  type JekoConfig,
} from './client';

export type JekoStoreBalance =
  | { kind: 'ok'; balanceFcfa: number }
  | { kind: 'unknown'; raw: string };

const AMOUNT_KEYS = [
  'balance',
  'availableBalance',
  'available',
  'amountCents',
  'balanceCents',
  'amount',
] as const;

/** Montant en centimes sous une clé usuelle, y compris `{ amount, currency }`. */
export function extractBalanceCents(body: unknown, depth = 0): number | null {
  if (typeof body === 'number' && Number.isFinite(body)) return body;
  if (depth > 2 || body === null || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  for (const key of AMOUNT_KEYS) {
    if (!(key in record)) continue;
    const found = extractBalanceCents(record[key], depth + 1);
    if (found !== null) return found;
  }
  return null;
}

export async function getJekoStoreBalance(
  config: JekoConfig,
  fetchFn: FetchFn = fetch
): Promise<JekoStoreBalance> {
  const res = await call(
    fetchFn,
    `${baseUrl(config)}/partner_api/stores/${encodeURIComponent(config.storeId)}/balance`,
    { headers: authHeaders(config) }
  );
  const body = await parseOrThrow(res);
  const cents = extractBalanceCents(body);
  if (cents === null) {
    return { kind: 'unknown', raw: JSON.stringify(body).slice(0, 500) };
  }
  return { kind: 'ok', balanceFcfa: Math.round(cents / CENTS_PER_FCFA) };
}

export type RemoteBalanceView =
  | { kind: 'ok'; balanceFcfa: number }
  | { kind: 'unknown'; raw: string }
  | { kind: 'error'; message: string }
  | { kind: 'unconfigured' };

/** Jamais bloquant : la page des soldes doit s'afficher même si Jèko est en panne. */
export async function fetchRemoteBalance(
  config: JekoConfig | null
): Promise<RemoteBalanceView> {
  if (!config) return { kind: 'unconfigured' };
  try {
    return await getJekoStoreBalance(config);
  } catch (err) {
    return {
      kind: 'error',
      message: err instanceof Error ? err.message : 'Jèko injoignable',
    };
  }
}
