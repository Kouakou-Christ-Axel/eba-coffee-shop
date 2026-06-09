// app/api/caisse/orders/[id]/payment/route.ts
//
// PATCH /api/caisse/orders/:id/payment
// Body : { isPaid: boolean, paymentMode?: 'CASH' | 'WAVE' | 'OTHER' }
//
// Règle : si isPaid=true, paymentMode est requis.
// Optimistic concurrency : on update WHERE isPaid=<oldValue> et on rejette si
// 0 rows affected (double-clic, ou modif concurrente d'un autre caissier).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import { paymentModeSchema } from '@/lib/schemas/order';
import { setOrderPayment, OrderMutationError } from '@/lib/order-mutations';

const bodySchema = z
  .object({
    isPaid: z.boolean(),
    paymentMode: paymentModeSchema.optional(),
  })
  .refine((data) => !data.isPaid || data.paymentMode !== undefined, {
    message: 'paymentMode requis quand isPaid=true',
    path: ['paymentMode'],
  });

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { isPaid, paymentMode } = parsed.data;

  try {
    const { startedPreparation } = await setOrderPayment(
      id,
      isPaid,
      paymentMode
    );
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
