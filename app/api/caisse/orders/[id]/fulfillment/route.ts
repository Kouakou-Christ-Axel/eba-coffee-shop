// app/api/caisse/orders/[id]/fulfillment/route.ts
//
// PATCH /api/caisse/orders/:id/fulfillment
// Body : { orderType?, pickupTime?, driverName?, driverPhone?, note? }
//
// Édition « prise en charge » d'une commande depuis la caisse (CASHIER_PLUS).
// Ne touche jamais isPaid/paymentMode — voir `updateOrderFulfillment`
// (lib/order-mutations.ts) et `updateOrderFulfillmentSchema`
// (lib/schemas/order.ts).

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { updateOrderFulfillmentSchema } from '@/lib/schemas/order';
import {
  updateOrderFulfillment,
  OrderMutationError,
} from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = updateOrderFulfillmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    await updateOrderFulfillment(id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    throw err;
  }
}
