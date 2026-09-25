// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, createOrderSchema } from '@/lib/orders';
import { sendNewOrderEmail } from '@/lib/email';
import type { CartItem } from '@/lib/cart-store';
import {
  publicOrderError,
  publicOrderErrorResponse,
} from '@/lib/orders/public-error-response';

// Réponses d'erreur : toujours un `code` stable (voir `checkoutErrorCodeSchema`,
// lib/schemas/order.ts) — le client aiguille dessus, le `error` reste le
// message lisible. Mapping partagé avec le libre-service après commande.

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicOrderError(400, 'INVALID_BODY', 'Corps de requête invalide');
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return publicOrderError(400, 'VALIDATION', parsed.error.flatten());
  }

  try {
    const order = await createOrder(parsed.data);
    sendNewOrderEmail({
      ...order,
      items: order.items as CartItem[],
    }).catch((err) => {
      console.error('[email] Échec notification propriétaire :', err);
    });
    return NextResponse.json(
      { id: order.id, reference: order.reference },
      { status: 201 }
    );
  } catch (err) {
    return publicOrderErrorResponse(err, 'POST /api/commandes');
  }
}
