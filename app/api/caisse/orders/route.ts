// app/api/caisse/orders/route.ts
//
// POST /api/caisse/orders
// Crée une commande walk-in depuis l'écran caissier OU cuisine (les deux
// surfaces réutilisent ce même endpoint — cf. `NewOrderView`).
// Body : { items, customerName?, customerPhone?, orderType, note?, pickupTime?,
//          orderDate?, coverShortage? }
//
// `orderDate` (YYYY-MM-DD) permet d'antidater une commande ancienne ; absent =
// jour en cours. La logique de création (numérotation thread-safe, upsert
// client, fidélité, antidatage) vit dans `lib/order-mutations.ts`.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  createOrderSchema,
  orderTypeSchema,
  isBackdateCompatibleWithPickup,
  BACKDATE_PICKUP_CONFLICT_MESSAGE,
} from '@/lib/schemas/order';
import {
  createCashierOrder,
  getItemsShortage,
  OrderMutationError,
  StockShortageError,
} from '@/lib/order-mutations';
import type { CartItem } from '@/lib/cart-store';

const bodySchema = createOrderSchema
  .extend({
    orderType: orderTypeSchema,
    // Ardoise forcée par le caissier pour un client non fiché « de confiance »
    // (ou refusée pour un sur-place/à-emporter qui en bénéficierait par défaut).
    onAccount: z.boolean().optional(),
    // Le staff a confirmé avoir produit la quantité manquante après une 409
    // de pénurie — cf. `useShortageConfirm`.
    coverShortage: z.boolean().optional(),
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
    // La cuisine peut désormais créer des commandes elle-même (elles
    // partent direct en préparation, cf. `createCashierOrder`) —
    // `requireKitchen()` couvre caisse + cuisine (+ rôles supérieurs).
    session = await requireKitchen();
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
    // Une commande de confiance / sur-place / à-emporter part directement en
    // cuisine et RÉSERVE son stock (cf. `createCashierOrder`) : elle peut donc
    // échouer en 409 « Stock insuffisant pour … ». La liste chiffrée des
    // manques accompagne la réponse — même forme que les autres routes caisse
    // — pour que l'écran propose « vous venez de les produire ? » au lieu d'un
    // mur (cf. `useShortageConfirm`).
    if (err instanceof StockShortageError) {
      return NextResponse.json(
        {
          error: err.message,
          shortage: await getItemsShortage(parsed.data.items as CartItem[]),
        },
        { status: err.httpStatus }
      );
    }
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
