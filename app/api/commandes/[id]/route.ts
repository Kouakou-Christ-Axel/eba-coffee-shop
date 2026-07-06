// app/api/commandes/[id]/route.ts
//
// GET /api/commandes/:id — état public d'une commande pour la page de suivi
// (/commande/:id, polling). Sans authentification : l'`id` cuid non devinable
// sert de capability URL (la page est noindex). Ne renvoie que le sous-ensemble
// sûr défini par `getPublicOrder` (lib/orders.ts) — pas la ligne Prisma brute.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const order = await getPublicOrder(id);
    if (!order) {
      return NextResponse.json(
        { error: 'Commande introuvable' },
        { status: 404 }
      );
    }
    return NextResponse.json(order, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[GET /api/commandes/:id]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
