// app/api/commandes/[id]/paiement/route.ts
//
// POST /api/commandes/:id/paiement — démarrer ou RELANCER le paiement d'une
// commande en attente : « Réessayer » après un échec, ou autre moyen de paiement.
// Le montant n'est jamais fourni par le navigateur : il est relu en base
// (lib/jeko/start-payment.ts). Réponse : `{ paymentUrl, expiresAt }`.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jekoConfig } from '@/lib/jeko/config';
import { JEKO_PAYMENT_METHODS } from '@/lib/jeko/payment-methods';
import { startJekoPayment } from '@/lib/jeko/start-payment';
import {
  allowPaymentStart,
  paymentRateKey,
} from '@/lib/order-payment-rate-limit';
import {
  publicOrderError,
  publicOrderErrorResponse,
} from '@/lib/orders/public-error-response';
import { siteUrl } from '@/lib/site-url';

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ paymentMethod: z.enum(JEKO_PAYMENT_METHODS) });

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  if (!allowPaymentStart(paymentRateKey(req, id))) {
    return publicOrderError(
      429,
      'RATE_LIMITED',
      'Trop de tentatives : réessaie dans quelques minutes.'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicOrderError(400, 'INVALID_BODY', 'Corps de requête invalide');
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return publicOrderError(400, 'VALIDATION', parsed.error.flatten());
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
    const payment = await startJekoPayment({
      orderId: id,
      paymentMethod: parsed.data.paymentMethod,
      config,
      siteUrl: siteUrl(),
    });
    return NextResponse.json({
      paymentUrl: payment.redirectUrl,
      expiresAt: payment.expiresAt.toISOString(),
    });
  } catch (err) {
    return publicOrderErrorResponse(err, 'POST /api/commandes/:id/paiement');
  }
}
