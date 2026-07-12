// app/api/caisse/loyalty/route.ts
//
// GET /api/caisse/loyalty?phone=...
// Carte de fidélité d'un client (par téléphone), pour la caisse : avancement
// (tampons) + récompenses disponibles à proposer au client AVANT de valider la
// commande (bouton « Appliquer -X F » dans l'écran Nouvelle commande).
//
// Réutilise `getLoyaltyCardByPhone` (lib/loyalty.ts) — même source que la
// fiche client CRM et l'outil MCP `get_loyalty_card`.

import { NextResponse } from 'next/server';
import { requireCashier } from '@/lib/auth-helpers';
import { getLoyaltyCardByPhone } from '@/lib/loyalty';

export async function GET(req: Request) {
  try {
    await requireCashier();
  } catch {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const phone = new URL(req.url).searchParams.get('phone')?.trim() ?? '';
  if (!phone) {
    return NextResponse.json({ card: null });
  }

  try {
    const card = await getLoyaltyCardByPhone(phone);
    if (!card) {
      return NextResponse.json({ card: null });
    }
    return NextResponse.json({
      card: {
        stampCount: card.stampCount,
        stampsPerCard: card.settings.stampsPerCard,
        availableRewards: card.availableRewards.map((r) => ({
          id: r.id,
          tier: r.tier,
          capAmount: r.capAmount,
        })),
      },
    });
  } catch (err) {
    console.error('[GET /api/caisse/loyalty]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
