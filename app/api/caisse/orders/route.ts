// app/api/caisse/orders/route.ts
//
// POST /api/caisse/orders
// Crée une commande walk-in depuis l'écran caissier.
// Body : { items, customerName?, customerPhone?, orderType, note?, pickupTime?,
//          orderDate? }
//
// `orderDate` (YYYY-MM-DD) permet d'antidater une commande ancienne ; absent =
// jour en cours. La logique de création (numérotation thread-safe, upsert
// client, fidélité, antidatage) vit dans `lib/order-mutations.ts`.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { createOrderSchema, orderTypeSchema } from '@/lib/schemas/order';
import { createCashierOrder } from '@/lib/order-mutations';

const bodySchema = createOrderSchema.extend({
  orderType: orderTypeSchema,
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const order = await createCashierOrder({
      ...parsed.data,
      createdById: session.user.id,
    });

    return NextResponse.json(
      {
        id: order.id,
        reference: order.reference,
        dailyNumber: order.dailyNumber,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/caisse/orders]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
