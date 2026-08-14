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
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import {
  createOrderSchema,
  orderTypeSchema,
  isBackdateCompatibleWithPickup,
  BACKDATE_PICKUP_CONFLICT_MESSAGE,
} from '@/lib/schemas/order';
import { createCashierOrder, OrderMutationError } from '@/lib/order-mutations';

const bodySchema = createOrderSchema
  .extend({
    orderType: orderTypeSchema,
    // Ardoise forcée par le caissier pour un client non fiché « de confiance ».
    onAccount: z.boolean().optional(),
  })
  // Antidater ET planifier un retrait un autre jour est contradictoire —
  // règle posée EN DERNIER, un `.refine` interdisant tout `.extend` ultérieur.
  .refine(isBackdateCompatibleWithPickup, {
    message: BACKDATE_PICKUP_CONFLICT_MESSAGE,
    path: ['pickupTime'],
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
    // La commande d'un client de confiance part directement en cuisine et
    // RÉSERVE son stock (cf. `createCashierOrder`) : elle peut donc échouer en
    // 409 « Stock insuffisant pour … ». Ce message doit atteindre le caissier
    // tel quel — un « Erreur serveur » générique ne lui dirait pas quel article
    // remplacer. Les autres erreurs métier (400 récompense fidélité indisponible)
    // passent par le même chemin.
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('[POST /api/caisse/orders]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
