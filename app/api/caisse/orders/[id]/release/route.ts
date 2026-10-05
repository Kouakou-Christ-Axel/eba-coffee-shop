// app/api/caisse/orders/[id]/release/route.ts
//
// POST /api/caisse/orders/:id/release
// « Prendre en caisse » une commande en ligne en attente de paiement : elle
// devient une commande caisse ordinaire, encaissable par les moyens habituels
// (sans Jèko, donc sans frais). Cf. lib/orders/pending-payment.ts.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { OrderMutationError } from '@/lib/order-mutations';
import { releasePendingOrder } from '@/lib/orders/pending-payment';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await releasePendingOrder(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderMutationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.httpStatus }
      );
    }
    console.error('[POST /api/caisse/orders/:id/release]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
