// app/api/caisse/orders/[id]/payment/route.ts
//
// PATCH /api/caisse/orders/:id/payment
// Body : { isPaid: boolean, payments?: { mode: PaymentMode; amount: number }[] }
//
// Règle : si isPaid=true, payments est requis (1..N lignes dont la somme doit
// égaler EXACTEMENT le total de la commande — paiement fractionné supporté,
// pas de paiement partiel/layaway).
// Optimistic concurrency : on update WHERE isPaid=<oldValue> et on rejette si
// 0 rows affected (double-clic, ou modif concurrente d'un autre caissier).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import { orderPaymentsSchema } from '@/lib/schemas/order';
import { setOrderPayment, OrderMutationError } from '@/lib/order-mutations';

// Un paiement réussi peut avoir décrémenté du stock (produit/option) : la carte
// publique (ISR) doit se rafraîchir. Best-effort, jamais bloquant — l'écriture
// en base a déjà eu lieu (même pattern que `revalidateMenu` du MCP).
function revalidatePublicMenu() {
  try {
    revalidatePath('/api/menu');
    revalidatePath('/carte');
  } catch (err) {
    console.warn('[caisse/payment] revalidatePublicMenu a échoué', err);
  }
}

const bodySchema = z
  .object({
    isPaid: z.boolean(),
    payments: orderPaymentsSchema.optional(),
  })
  .refine((data) => !data.isPaid || data.payments !== undefined, {
    message: 'payments requis quand isPaid=true',
    path: ['payments'],
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

  const { isPaid, payments } = parsed.data;

  try {
    const { startedPreparation } = await setOrderPayment(
      id,
      isPaid,
      payments,
      session.user.id
    );
    if (isPaid) revalidatePublicMenu();
    return NextResponse.json({ ok: true, startedPreparation });
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
