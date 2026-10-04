// app/api/commandes/[id]/paiement/verifier/route.ts
//
// POST /api/commandes/:id/paiement/verifier — le client est de retour de chez Jèko
// (ou attend sur la page de suivi) : on lit la demande de paiement et, si elle a
// réussi, on règle la commande SANS attendre le webhook (Jèko peut mettre jusqu'à
// 5 min à réconcilier). Le webhook reste la source de vérité ; `settle` est
// idempotent. Aucune donnée du navigateur n'est crue : seul l'identifiant compte.
// Réponse : `{ status, errorReason }` ; le client recharge ensuite la commande.

import { NextResponse } from 'next/server';
import { jekoConfig } from '@/lib/jeko/config';
import { reconcileOrderPayment } from '@/lib/jeko/reconcile';
import {
  allowPaymentVerify,
  paymentRateKey,
} from '@/lib/order-payment-rate-limit';
import {
  publicOrderError,
  publicOrderErrorResponse,
} from '@/lib/orders/public-error-response';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  if (!allowPaymentVerify(paymentRateKey(req, id))) {
    return publicOrderError(
      429,
      'RATE_LIMITED',
      'Trop de tentatives : réessaie dans quelques instants.'
    );
  }

  const config = jekoConfig();
  if (!config) {
    return publicOrderError(
      503,
      'PAYMENT_PROVIDER_ERROR',
      "Le paiement en ligne n'est pas disponible"
    );
  }

  try {
    return NextResponse.json(await reconcileOrderPayment(id, config));
  } catch (err) {
    return publicOrderErrorResponse(
      err,
      'POST /api/commandes/:id/paiement/verifier'
    );
  }
}
