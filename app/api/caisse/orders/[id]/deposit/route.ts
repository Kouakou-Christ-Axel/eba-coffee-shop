// app/api/caisse/orders/[id]/deposit/route.ts
//
// PATCH /api/caisse/orders/:id/deposit
// Body : { payments: { mode: PaymentMode; amount: number }[] }
//
// Encaisse un versement d'acompte (commande spéciale à l'avance, cf.
// `Order.depositRequired`). Distinct de /payment : ne solde jamais la
// commande, ne déclenche jamais l'entrée en cuisine ni la réservation de
// stock — c'est `sendOrderToKitchen` qui vérifie ensuite que l'acompte est
// couvert. Seule route qui permet à l'écran caisse (file du jour) d'encaisser
// CE montant précis : sans elle, un gâteau avec acompte ne pouvait être réglé
// que depuis la fiche détail de la commande.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import { orderPaymentsSchema } from '@/lib/schemas/order';
import { recordDeposit, OrderMutationError } from '@/lib/order-mutations';

const bodySchema = z.object({
  payments: orderPaymentsSchema,
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await recordDeposit(
      id,
      parsed.data.payments,
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
