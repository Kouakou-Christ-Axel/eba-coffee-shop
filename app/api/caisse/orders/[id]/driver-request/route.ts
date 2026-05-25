// app/api/caisse/orders/[id]/driver-request/route.ts
//
// PATCH /api/caisse/orders/:id/driver-request
// Body : { requested: boolean }
//
// requested=true  → set driverRequested + driverRequestedAt
//                  Permis pour KITCHEN+ (canRequestDriver)
// requested=false → dismiss
//                  Permis pour CASHIER+ (canDismissDriverRequest)

import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  canRequestDriver,
  canDismissDriverRequest,
} from '@/lib/order-permissions';
import type { UserRole } from '@/generated/prisma/client';

const bodySchema = z.object({ requested: z.boolean() });

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  let session;
  try {
    session = await requireKitchen();
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

  const { requested } = parsed.data;

  // Permissions différenciées set vs dismiss
  if (requested && !canRequestDriver(role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }
  if (!requested && !canDismissDriverRequest(role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Optimistic concurrency : seulement si l'état actuel diffère
  const result = await prisma.order.updateMany({
    where: { id, driverRequested: !requested },
    data: {
      driverRequested: requested,
      driverRequestedAt: requested ? new Date() : null,
    },
  });

  if (result.count === 0) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json(
        { error: 'Commande introuvable' },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'État déjà à jour' }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
