// app/api/loyalty-info/route.ts
//
// GET /api/loyalty-info — seuil fidélité public pour le checkout.
// GET /api/loyalty-info?phone=07… — ajoute la récompense utilisable du client
// résolu par téléphone (checkout en ligne, sans compte).
// GET /api/loyalty-info?phone=07…&cartTotal=2500 — ajoute aussi `message`, le
// texte incitatif fidélité du récapitulatif de commande (avant paiement),
// calculé côté serveur (jamais côté client, pour éviter toute manipulation).
//
// N'expose que le strict nécessaire :
//   - sans `phone` : { enabled, minOrderAmount } pour le message "plus que X
//     FCFA pour gagner ton point de fidélité" (/carte/commande) ;
//   - avec `phone` : + { reward: { id, capAmount } | null } — ni nom, ni
//     compteur de tampons (moins que ce que la page de suivi montre déjà à
//     quiconque détient l'URL capability). La consommation est revalidée
//     côté serveur dans la transaction de commande (lib/orders.ts). `message`
//     est un texte résolu (jamais le compteur brut) : même logique
//     d'exposition minimale que `reward`.

import { NextRequest, NextResponse } from 'next/server';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import {
  getAvailableRewardForPhone,
  getLoyaltyCardByPhone,
} from '@/lib/loyalty';
import { computeCheckoutLoyaltyMessage } from '@/lib/loyalty-messaging';
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
      return NextResponse.json({ ...base, reward: null, message: null });
    }

    const cartTotalRaw = req.nextUrl.searchParams.get('cartTotal');
    const cartTotal =
      cartTotalRaw !== null && Number.isFinite(Number(cartTotalRaw))
        ? Math.max(0, Math.trunc(Number(cartTotalRaw)))
        : null;

    // Garde-fous spec : programme désactivé ou client non identifiable →
    // aucun message fidélité (jamais de branche affichée sans état réel).
    if (!settings.enabled || cartTotal === null) {
      const reward = settings.enabled
        ? await getAvailableRewardForPhone(phone)
        : null;
      return NextResponse.json({ ...base, reward, message: null });
    }

    const card = await getLoyaltyCardByPhone(phone);
    if (!card) {
      return NextResponse.json({ ...base, reward: null, message: null });
    }

    const reward = card.availableRewards[0]
      ? {
          id: card.availableRewards[0].id,
          capAmount: card.availableRewards[0].capAmount,
        }
      : null;
    const message = computeCheckoutLoyaltyMessage({
      cartTotal,
      stampCount: card.stampCount,
      settings,
    });

    return NextResponse.json({ ...base, reward, message });
  } catch {
    return NextResponse.json(
      { error: 'Impossible de charger les réglages de fidélité' },
      { status: 500 }
    );
  }
}
