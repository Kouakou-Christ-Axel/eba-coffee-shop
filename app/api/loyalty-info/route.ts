// app/api/loyalty-info/route.ts
//
// GET /api/loyalty-info — seuil fidélité public pour le checkout.
// GET /api/loyalty-info?phone=07… — ajoute la récompense utilisable du client
// résolu par téléphone (checkout en ligne, sans compte).
//
// N'expose que le strict nécessaire :
//   - sans `phone` : { enabled, minOrderAmount } pour le message "plus que X
//     FCFA pour gagner ton point de fidélité" (/carte/commande) ;
//   - avec `phone` : + { reward: { id, capAmount } | null } — ni nom, ni
//     compteur de tampons (moins que ce que la page de suivi montre déjà à
//     quiconque détient l'URL capability). La consommation est revalidée
//     côté serveur dans la transaction de commande (lib/orders.ts).

import { NextRequest, NextResponse } from 'next/server';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { getAvailableRewardForPhone } from '@/lib/loyalty';
import { ORDER_CUSTOMER_PHONE_MAX } from '@/config/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const settings = await getLoyaltySettings();
    const base = {
      enabled: settings.enabled,
      minOrderAmount: settings.minOrderAmount,
    };

    const phone = req.nextUrl.searchParams.get('phone')?.trim();
    if (!phone) {
      return NextResponse.json(base);
    }
    if (phone.length < 8 || phone.length > ORDER_CUSTOMER_PHONE_MAX) {
      return NextResponse.json({ ...base, reward: null });
    }

    const reward = await getAvailableRewardForPhone(phone);
    return NextResponse.json({ ...base, reward });
  } catch {
    return NextResponse.json(
      { error: 'Impossible de charger les réglages de fidélité' },
      { status: 500 }
    );
  }
}
