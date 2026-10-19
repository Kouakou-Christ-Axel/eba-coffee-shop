// Contacts bénéficiaires et transferts sortants (Pay-out), pour tester le
// remboursement d'un paiement tardif sans argent réel.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { apiError, readBody, sendJson } from './http';

const CONTACT_METHODS = [
  'wave',
  'orange_money',
  'mtn',
  'moov',
  'djamo',
  'bank',
];

export type MockTransfers = {
  contacts: Map<string, { id: string; paymentMethod: string; number: string }>;
  transfers: Map<string, Record<string, unknown>>;
  transferReferences: Set<string>;
};

export const createMockTransfers = (): MockTransfers => ({
  contacts: new Map(),
  transfers: new Map(),
  transferReferences: new Set(),
});

async function jsonBody(req: IncomingMessage): Promise<
  Record<string, unknown> & {
    identifier?: { number?: string };
    paymentMethod?: string;
    name?: string;
    contactId?: string;
    reference?: string;
    currency?: string;
    amountCents?: number;
    storeId?: string;
    description?: string;
  }
> {
  try {
    return JSON.parse((await readBody(req)) || '{}');
  } catch {
    return {};
  }
}

export async function createContact(
  req: IncomingMessage,
  res: ServerResponse,
  state: MockTransfers
) {
  const body = await jsonBody(req);
  const number = body.identifier?.number;
  if (
    !CONTACT_METHODS.includes(body.paymentMethod ?? '') ||
    !body.name ||
    !number
  ) {
    return apiError(res, 422, 'validation_error', 'Validation error');
  }
  const contact = {
    id: randomUUID(),
    paymentMethod: body.paymentMethod as string,
    number,
  };
  state.contacts.set(contact.id, contact);
  sendJson(res, 200, { ...contact, name: body.name, identifier: { number } });
}

export async function createTransfer(
  req: IncomingMessage,
  res: ServerResponse,
  state: MockTransfers
) {
  const body = await jsonBody(req);
  const contact = state.contacts.get(body.contactId ?? '');
  if (!contact)
    return apiError(res, 404, 'contact_not_found', 'Contact not found');
  const ref = body.reference ?? '';
  const amountCents = body.amountCents ?? 0;
  if (
    body.currency !== 'XOF' ||
    !Number.isInteger(amountCents) ||
    amountCents < 500 ||
    ref.length < 5 ||
    ref.length > 100
  ) {
    return apiError(res, 422, 'validation_error', 'Validation error');
  }
  if (state.transferReferences.has(ref)) {
    return apiError(
      res,
      409,
      'transaction_exists_with_reference',
      'Référence déjà utilisée'
    );
  }
  state.transferReferences.add(ref);
  const transfer = {
    id: `wth_${randomUUID().slice(0, 12)}`,
    storeId: body.storeId,
    contactId: contact.id,
    amount: { amount: amountCents, currency: 'XOF' },
    fees: { amount: Math.ceil(amountCents * 0.01), currency: 'XOF' },
    status: 'pending',
    paymentMethod: contact.paymentMethod,
    beneficiary: contact.number,
    description: body.description ?? null,
    reference: ref,
    createdAt: new Date().toISOString(),
  };
  state.transfers.set(transfer.id, transfer);
  sendJson(res, 200, transfer);
}

export function getTransfer(
  res: ServerResponse,
  state: MockTransfers,
  id: string
) {
  const transfer = state.transfers.get(id);
  return transfer
    ? sendJson(res, 200, transfer)
    : apiError(res, 404, 'not_found', 'Transfert introuvable');
}

/** Gestes du « opérateur » : un transfert créé `pending` finit success ou error. */
export function settleTransfer(
  res: ServerResponse,
  state: MockTransfers,
  id: string,
  outcome: string
) {
  const transfer = state.transfers.get(id);
  if (!transfer)
    return apiError(res, 404, 'not_found', 'Transfert introuvable');
  if (outcome === 'succeed') transfer.status = 'success';
  else if (outcome === 'fail') {
    transfer.status = 'error';
    transfer.error = { id: 'transfer_failed' };
  } else return apiError(res, 404, 'not_found', 'Geste inconnu');
  sendJson(res, 200, transfer);
}
