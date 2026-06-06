// GET /api/preparation/queue
//
// Endpoint de polling pour l'écran cuisine (KDS). Retourne le même snapshot JSON
// que les événements SSE `queue`, utilisé comme fallback quand le SSE est bloqué
// (ex. proxy Cloudflare qui bufferise les réponses de longue durée).

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchPreparationQueue,
  type PreparationOrder,
} from '@/lib/preparation-queue';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import type { UserRole } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';

type SerializedPreparationOrder = Omit<
  PreparationOrder,
  'pickupTime' | 'createdAt'
> & {
  pickupTime: string | null;
  createdAt: string;
};

function serialize(orders: PreparationOrder[]): SerializedPreparationOrder[] {
  return orders.map((o) => ({
    ...o,
    pickupTime: o.pickupTime ? o.pickupTime.toISOString() : null,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  const role = session?.user.role as UserRole | undefined;
  if (!session || !role || !ROLE_GROUPS.KITCHEN_PLUS.includes(role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const orders = await fetchPreparationQueue();
  return NextResponse.json(serialize(orders), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
