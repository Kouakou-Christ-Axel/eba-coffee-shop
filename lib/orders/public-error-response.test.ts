// lib/orders/public-error-response.test.ts
//
// Traduction des erreurs du paiement en ligne en réponses HTTP avec un `code`
// STABLE : le client aiguille dessus, jamais sur le texte du message. Le détail
// d'une panne du fournisseur ne doit jamais fuiter vers le navigateur.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publicOrderErrorResponse } from './public-error-response';
import { CartMismatchError } from './cart-verification';
import { JekoApiError } from '@/lib/jeko/client';
import { PaymentNotPendingError } from '@/lib/jeko/start-payment';

vi.mock('@/lib/prisma', () => ({ default: {} }));

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe('publicOrderErrorResponse — paiement en ligne', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('un panier qui ne correspond plus au menu → 409 CART_CHANGED, avec la cause', async () => {
    const res = await read(
      publicOrderErrorResponse(
        new CartMismatchError('price_changed', 'Le prix de « Café » a changé'),
        'test'
      )
    );
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'CART_CHANGED',
      reason: 'price_changed',
    });
  });

  it('une commande qui ne peut plus être payée → 409 CONFLICT, avec la raison', async () => {
    const res = await read(
      publicOrderErrorResponse(new PaymentNotPendingError('expired'), 'test')
    );
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CONFLICT', reason: 'expired' });
  });

  it('une commande introuvable → 404 NOT_FOUND', async () => {
    const res = await read(
      publicOrderErrorResponse(new PaymentNotPendingError('not_found'), 'test')
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('une panne de Jèko → 502 PAYMENT_PROVIDER_ERROR, sans exposer son détail', async () => {
    const res = await read(
      publicOrderErrorResponse(
        new JekoApiError(
          500,
          'server_error',
          'clé API invalide pour le magasin X'
        ),
        'test'
      )
    );
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('clé API');
  });
});
