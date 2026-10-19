// lib/jeko/transfers.ts
//
// Transferts sortants de l'API Partner Jèko (Pay-out) : sert à REMBOURSER un
// client. Jèko n'a pas d'API de remboursement dédiée : on crée un contact
// bénéficiaire (numéro Mobile Money) puis un transfert vers ce contact. Le moyen
// de paiement se définit sur le contact, pas sur le transfert.
//
// Unités : comme `client.ts`, centimes côté API, FCFA entiers partout ailleurs.

import {
  CENTS_PER_FCFA,
  authHeaders,
  baseUrl,
  call,
  parseOrThrow,
  type FetchFn,
  type JekoConfig,
  type JekoPaymentMethod,
} from './client';

/** Méthode de contact Jèko pour chaque moyen proposé au checkout. */
const CONTACT_METHOD: Record<JekoPaymentMethod, string> = {
  wave: 'wave',
  orange: 'orange_money',
  mtn: 'mtn',
  moov: 'moov',
  djamo: 'djamo',
};

/** Minimum d'un transfert Mobile Money (FCFA) : 100 F chez Moov, 5 F ailleurs. */
export function minTransferFcfa(method: JekoPaymentMethod): number {
  return method === 'moov' ? 100 : 5;
}

export function toTransferMethod(
  method: string | null | undefined
): JekoPaymentMethod | null {
  return method && method in CONTACT_METHOD
    ? (method as JekoPaymentMethod)
    : null;
}

export type JekoTransferStatus = 'pending' | 'success' | 'error';

export async function createJekoContact(
  config: JekoConfig,
  input: { name: string; method: JekoPaymentMethod; phoneE164: string },
  fetchFn: FetchFn = fetch
): Promise<{ id: string }> {
  const res = await call(fetchFn, `${baseUrl(config)}/partner_api/contacts`, {
    method: 'POST',
    headers: { ...authHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      paymentMethod: CONTACT_METHOD[input.method],
      identifier: { number: input.phoneE164 },
    }),
  });
  const body = await parseOrThrow(res);
  return { id: body.id as string };
}

/**
 * `reference` : 5 à 100 caractères, unique chez Jèko. Un 409 (`JekoApiError`) veut
 * dire que ce transfert existe déjà : l'appelant NE le recrée PAS.
 */
export async function createJekoTransfer(
  config: JekoConfig,
  input: {
    contactId: string;
    amountFcfa: number;
    reference: string;
    description: string;
  },
  fetchFn: FetchFn = fetch
): Promise<{ id: string; status: JekoTransferStatus; feeFcfa: number }> {
  if (!Number.isInteger(input.amountFcfa) || input.amountFcfa <= 0) {
    throw new Error(`Montant de transfert invalide : ${input.amountFcfa}`);
  }
  if (input.reference.length < 5 || input.reference.length > 100) {
    throw new Error('Référence de transfert invalide : 5 à 100 caractères');
  }
  const res = await call(fetchFn, `${baseUrl(config)}/partner_api/transfers`, {
    method: 'POST',
    headers: { ...authHeaders(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: config.storeId,
      contactId: input.contactId,
      amountCents: input.amountFcfa * CENTS_PER_FCFA,
      currency: 'XOF',
      reference: input.reference,
      description: input.description.slice(0, 255),
    }),
  });
  const body = await parseOrThrow(res);
  const fees = body.fees as { amount?: number } | null | undefined;
  return {
    id: body.id as string,
    status: body.status as JekoTransferStatus,
    feeFcfa: (fees?.amount ?? 0) / CENTS_PER_FCFA,
  };
}

/**
 * Relit un transfert (`GET /partner_api/transfers/{id}`) : un transfert créé
 * `pending` finit `success` ou `error`, et personne ne nous le dit (le webhook de
 * transfert n'est pas exploité). `errorCode` : meilleure lecture possible de la
 * raison d'échec (la page « Gérer les échecs » donne `error.id`).
 */
export async function getJekoTransfer(
  config: JekoConfig,
  id: string,
  fetchFn: FetchFn = fetch
): Promise<{
  id: string;
  status: JekoTransferStatus;
  feeFcfa: number;
  errorCode: string | null;
}> {
  const res = await call(
    fetchFn,
    `${baseUrl(config)}/partner_api/transfers/${encodeURIComponent(id)}`,
    { headers: authHeaders(config) }
  );
  const body = await parseOrThrow(res);
  const fees = body.fees as { amount?: number } | null | undefined;
  const error = body.error as { id?: string } | string | null | undefined;
  return {
    id: body.id as string,
    status: body.status as JekoTransferStatus,
    feeFcfa: (fees?.amount ?? 0) / CENTS_PER_FCFA,
    errorCode:
      (typeof error === 'string' ? error : error?.id) ??
      (body.errorReason as string | null | undefined) ??
      null,
  };
}
