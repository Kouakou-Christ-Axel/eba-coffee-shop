// app/api/caisse/orders/[id]/status/route.ts
//
// PATCH /api/caisse/orders/:id/status
// Body : { status: OrderStatus }
//
// Validation : transitions autorisées via lib/order-permissions selon le rôle.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCashier } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';
import { orderStatusSchema } from '@/lib/schemas/order';
import { setOrderStatus, OrderMutationError } from '@/lib/order-mutations';

const bodySchema = z.object({
  status: orderStatusSchema,
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

  try {
    await setOrderStatus(id, parsed.data.status, role);
    return NextResponse.json({ ok: true });
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
