// app/api/caisse/menu/route.ts
//
// GET /api/caisse/menu
// Renvoie le menu caisse (avec stock dérivé par produit/option, cf. getMenu).
// Sert au « stock live » : les écrans caisse (nouvelle commande, édition d'une
// commande) rafraîchissent périodiquement leur menu pour refléter une réappro
// faite ailleurs (autre appareil, cuisine) sans recharger la page.
//
// Réservé à la caisse (`requireCashier`). Non mis en cache.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { getMenu } from '@/lib/menu';
import {
  getPendingDemand,
  attachPendingDemand,
} from '@/lib/orders/pending-demand';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const [menu, pendingDemand] = await Promise.all([
    getMenu(),
    getPendingDemand(),
  ]);
  return NextResponse.json(
    { menu: attachPendingDemand(menu, pendingDemand.products) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
