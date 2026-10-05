// app/api/caisse/orders/pending/route.ts
//
// GET /api/caisse/orders/pending
// Commandes en ligne en attente de paiement (masquées de la file caisse) : le
// caissier peut relancer le client, annuler, ou prendre la commande en caisse.
// Lecture à la demande, hors flux SSE (cf. lib/orders/pending-payment.ts).

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { listPendingPaymentOrders } from '@/lib/orders/pending-payment';

export async function GET() {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  try {
    return NextResponse.json({ orders: await listPendingPaymentOrders() });
  } catch (err) {
    console.error('[GET /api/caisse/orders/pending]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
