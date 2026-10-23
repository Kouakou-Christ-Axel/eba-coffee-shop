// app/api/caisse/orders/[id]/credit/route.ts
//
// GET /api/caisse/orders/:id/credit → { balance, applicable }
// Avoir du client de la commande et part applicable selon la règle d'usage.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { getOrderCreditOffer } from '@/lib/credits/offer';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const { id } = await params;
  return NextResponse.json(await getOrderCreditOffer(id), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
