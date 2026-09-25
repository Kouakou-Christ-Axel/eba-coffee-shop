// lib/order-self-service-http.ts
//
// Enveloppe commune des routes de libre-service client
// (`app/api/commandes/[id]/{annulation,articles,creneau}`) : limitation de
// débit, lecture/validation du corps, exécution, puis renvoi de la vue
// publique À JOUR (`getPublicOrder`) — la page de suivi l'affiche sans
// attendre son prochain rafraîchissement. Erreurs traduites avec un `code`
// stable (lib/orders/public-error-response.ts).

import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getPublicOrder } from '@/lib/orders';
import {
  publicOrderError,
  publicOrderErrorResponse,
} from '@/lib/orders/public-error-response';
import {
  allowOrderSelfService,
  selfServiceRateKey,
} from '@/lib/order-self-service-rate-limit';

export async function runSelfService<S extends z.ZodType | null>(
  req: Request,
  id: string,
  schema: S,
  action: (input: S extends z.ZodType ? z.infer<S> : null) => Promise<void>,
  context: string
) {
  if (!allowOrderSelfService(selfServiceRateKey(req, id))) {
    return publicOrderError(
      429,
      'RATE_LIMITED',
      'Trop de tentatives : réessaie dans quelques minutes.'
    );
  }

  let input: unknown = null;
  if (schema) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return publicOrderError(400, 'INVALID_BODY', 'Corps de requête invalide');
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return publicOrderError(400, 'VALIDATION', parsed.error.flatten());
    }
    input = parsed.data;
  }

  try {
    await action(input as S extends z.ZodType ? z.infer<S> : null);
    return NextResponse.json({ order: await getPublicOrder(id) });
  } catch (err) {
    return publicOrderErrorResponse(err, context);
  }
}
