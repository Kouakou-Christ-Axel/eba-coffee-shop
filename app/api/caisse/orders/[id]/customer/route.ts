// app/api/caisse/orders/[id]/customer/route.ts
//
// PATCH /api/caisse/orders/:id/customer
// Body : { customerId } | { phone, name? } | { customerId: null }
//
// Associe (ou détache) un client à une commande existante. La logique métier
// (résolution client, upsert par téléphone, attribution de fidélité) vit dans
// `setOrderCustomer` (lib/order-mutations.ts) — la route ne fait que valider
// l'entrée et mapper les erreurs en codes HTTP.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { setOrderCustomerSchema } from '@/lib/schemas/order';
import { setOrderCustomer, OrderMutationError } from '@/lib/order-mutations';

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

  const parsed = setOrderCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { customerId } = await setOrderCustomer(
      id,
      parsed.data,
      session.user.id
    );
    return NextResponse.json({ ok: true, customerId });
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
