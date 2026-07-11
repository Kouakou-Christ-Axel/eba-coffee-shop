// app/api/loyalty-info/route.ts
//
// GET /api/loyalty-info — seuil fidélité public pour le checkout.
//
// N'expose que le strict nécessaire pour le message "plus que X FCFA pour
// gagner ton point de fidélité" pendant la saisie de commande (/carte/commande) :
// pas de détail sur les paliers/récompenses, pas de donnée sensible.

import { NextResponse } from 'next/server';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getLoyaltySettings();
    return NextResponse.json({
      enabled: settings.enabled,
      minOrderAmount: settings.minOrderAmount,
    });
  } catch {
    return NextResponse.json(
      { error: 'Impossible de charger les réglages de fidélité' },
      { status: 500 }
    );
  }
}
