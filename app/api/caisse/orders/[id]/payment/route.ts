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
import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { paymentModeSchema } from '@/lib/schemas/order';

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

  // Lecture pour vérifier le statut courant — on doit transitionner
  // NEW → PREPARING en même temps que le paiement (comportement par défaut :
  // payer envoie automatiquement la commande en cuisine).
  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true, status: true },
  });
  if (!order) {
    return NextResponse.json(
      { error: 'Commande introuvable' },
      { status: 404 }
    );
  }
  if (order.isPaid === isPaid) {
    return NextResponse.json(
      { error: 'État déjà à jour', currentIsPaid: order.isPaid },
      { status: 409 }
    );
  }

  // Si on encaisse une commande encore NEW, on la pousse aussi en cuisine.
  const shouldStartPreparation = isPaid && order.status === 'NEW';

  const result = await prisma.order.updateMany({
    where: { id, isPaid: !isPaid },
    data: {
      isPaid,
      paymentMode: isPaid ? paymentMode : null,
      paidAt: isPaid ? new Date() : null,
      ...(shouldStartPreparation ? { status: 'PREPARING' as const } : {}),
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: 'État modifié entre temps, recharger' },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    startedPreparation: shouldStartPreparation,
  });
}
