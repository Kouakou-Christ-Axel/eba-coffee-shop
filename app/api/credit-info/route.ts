// app/api/credit-info/route.ts
//
// GET /api/credit-info?phone=07…&total=4500 — avoir du client (par téléphone) et
// part applicable à un total net, pour le checkout en ligne. Le solde n'est
// retourné que s'il y a un avoir applicable ; la requête est limitée en débit
// (elle révèle l'existence d'un avoir pour un numéro).

import { NextRequest, NextResponse } from 'next/server';
import { ORDER_CUSTOMER_PHONE_MAX } from '@/config/constants';
import { getPublicCreditOffer } from '@/lib/credits/public-offer';
import { allowCreditLookup, clientIp } from '@/lib/enumeration-rate-limit';

export const dynamic = 'force-dynamic';

const NONE = { balance: 0, applicable: 0 };

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone')?.trim() ?? '';
  const total = Math.trunc(Number(req.nextUrl.searchParams.get('total')));
  if (
    phone.length < 8 ||
    phone.length > ORDER_CUSTOMER_PHONE_MAX ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return NextResponse.json(NONE);
  }
  if (!allowCreditLookup(clientIp(req))) {
    return NextResponse.json(
      { error: 'Trop de requêtes, réessayez dans une minute.' },
      { status: 429 }
    );
  }
  try {
    const offer = await getPublicCreditOffer(phone, total);
    return NextResponse.json(offer.applicable > 0 ? offer : NONE, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(NONE);
  }
}
