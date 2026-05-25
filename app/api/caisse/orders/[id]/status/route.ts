// app/api/caisse/orders/[id]/status/route.ts
//
// PATCH /api/caisse/orders/:id/status
// Body : { status: OrderStatus }
//
// Validation : transitions autorisées via lib/order-permissions selon le rôle.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { canTransition } from '@/lib/order-permissions';
import type { OrderStatus, UserRole } from '@/generated/prisma/client';

const bodySchema = z.object({
  status: z.enum(['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const role = session.user.role as UserRole;

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

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json(
      { error: 'Commande introuvable' },
      { status: 404 }
    );
  }

  const newStatus = parsed.data.status;
  if (!canTransition(order.status as OrderStatus, newStatus, role)) {
    return NextResponse.json(
      {
        error: `Transition non autorisée : ${order.status} → ${newStatus}`,
      },
      { status: 403 }
    );
  }

  // Optimistic concurrency : ne modifie que si l'état actuel est toujours celui lu
  const result = await prisma.order.updateMany({
    where: { id, status: order.status as OrderStatus },
    data: { status: newStatus },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: 'État déjà modifié par un autre caissier' },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
