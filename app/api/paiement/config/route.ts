// app/api/paiement/config/route.ts
//
// GET /api/paiement/config — dit au checkout si le paiement en ligne est actif, à
// quel taux de frais et avec quels moyens. Lu côté CLIENT plutôt que passé en prop :
// la page de checkout est prérendue, un drapeau lu côté serveur serait figé au build
// et resterait faux après un simple changement de variable d'environnement.
// Aucun secret n'est exposé : ni clé, ni identifiant de magasin.

import { NextResponse } from 'next/server';
import { jekoConfig, onlineFeePercent } from '@/lib/jeko/config';
import { JEKO_PAYMENT_METHODS } from '@/lib/jeko/payment-methods';

export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled = jekoConfig() !== null;
  return NextResponse.json(
    {
      enabled,
      feePercent: enabled ? onlineFeePercent() : 0,
      methods: enabled ? [...JEKO_PAYMENT_METHODS] : [],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
