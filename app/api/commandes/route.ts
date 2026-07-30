// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, createOrderSchema } from '@/lib/orders';
import { LoyaltyRewardUnavailableError } from '@/lib/loyalty-mutations';
import { sendNewOrderEmail } from '@/lib/email';
import type { CartItem } from '@/lib/cart-store';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide' },
      { status: 400 }
    );
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const order = await createOrder(parsed.data);
    sendNewOrderEmail({
      ...order,
      items: order.items as CartItem[],
    }).catch((err) => {
      console.error('[email] Échec notification propriétaire :', err);
    });
    return NextResponse.json(
      { id: order.id, reference: order.reference },
      { status: 201 }
    );
  } catch (err) {
    // Récompense consommée entre l'affichage du checkout et la soumission
    // (ex. utilisée au comptoir) : erreur métier, pas une erreur serveur.
    if (err instanceof LoyaltyRewardUnavailableError) {
      return NextResponse.json(
        { error: 'Récompense fidélité indisponible' },
        { status: 400 }
      );
    }
    console.error('[POST /api/commandes]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
