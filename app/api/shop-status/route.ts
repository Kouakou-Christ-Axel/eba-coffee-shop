// app/api/shop-status/route.ts
//
// GET /api/shop-status — la boutique est-elle ouverte À L'INSTANT ?
//
// Volontairement distinct de /api/pickup-slots (qui calcule des créneaux
// multi-jours avec capacité, coûteux pour une page à fort trafic comme
// /carte) : un seul booléen, pour le popup « on est fermé » de la carte
// publique (cf. closed-precommande-modal.tsx).

import { NextResponse } from 'next/server';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { isShopOpenNow } from '@/lib/pickup-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const settings = await getPickupSettings();
  return NextResponse.json({ openNow: isShopOpenNow(settings) });
}
