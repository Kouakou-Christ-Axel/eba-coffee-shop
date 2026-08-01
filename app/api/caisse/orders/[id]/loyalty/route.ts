// app/api/caisse/orders/[id]/loyalty/route.ts
//
// PATCH /api/caisse/orders/:id/loyalty
// Body : { loyaltyRewardId: string | null }
//
// Applique ou retire une récompense fidélité sur une commande déjà créée
// (contrairement à la création, où elle ne peut être choisie qu'à ce moment-
// là). La logique métier vit dans `setOrderLoyaltyReward`
// (lib/order-mutations.ts) — la route ne fait que valider l'entrée et mapper
// les erreurs en codes HTTP.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { setOrderLoyaltyRewardSchema } from '@/lib/schemas/order';
import {
  setOrderLoyaltyReward,
  OrderMutationError,
} from '@/lib/order-mutations';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireCashier();
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

  const parsed = setOrderLoyaltyRewardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await setOrderLoyaltyReward(
      id,
      parsed.data,
      session.user.id
    );
    return NextResponse.json({ ok: true, ...result });
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
