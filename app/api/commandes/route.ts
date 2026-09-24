// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  createOrderSchema,
  AdvanceOrderRequiredError,
  ScheduleUnavailableError,
  SoldOutTodayError,
} from '@/lib/orders';
import { LoyaltyRewardUnavailableError } from '@/lib/loyalty-mutations';
import { sendNewOrderEmail } from '@/lib/email';
import type { CartItem } from '@/lib/cart-store';
import type { CheckoutErrorCode } from '@/lib/schemas/order';

/** Réponse d'erreur du checkout : toujours un `code` stable (voir
 * `checkoutErrorCodeSchema`, lib/schemas/order.ts) — le client aiguille
 * dessus, le `error` reste le message lisible. */
function checkoutError(
  status: number,
  code: CheckoutErrorCode,
  error: unknown,
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({ code, error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return checkoutError(400, 'INVALID_BODY', 'Corps de requête invalide');
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return checkoutError(400, 'VALIDATION', parsed.error.flatten());
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
      return checkoutError(
        400,
        'LOYALTY_REWARD_UNAVAILABLE',
        'Récompense fidélité indisponible'
      );
    }
    // Date de retrait choisie (ou « dès que possible ») trop proche pour un
    // article exigeant une commande à l'avance (voir lib/orders.ts).
    if (err instanceof AdvanceOrderRequiredError) {
      return checkoutError(400, 'ADVANCE_ORDER_REQUIRED', err.message, {
        requiredDays: err.requiredDays,
      });
    }
    // Article hors planning récurrent / fenêtre « spécialité de la semaine »
    // à la date de retrait choisie (voir lib/orders.ts).
    if (err instanceof ScheduleUnavailableError) {
      return checkoutError(400, 'SCHEDULE_UNAVAILABLE', err.message, {
        productName: err.productName,
      });
    }
    // Article épuisé et retrait demandé pour aujourd'hui : commandable, mais
    // pour un autre jour (voir lib/orders.ts). 409 = conflit avec l'état du
    // stock ; `items` liste les lignes fautives pour que le client propose
    // une résolution ligne à ligne (remplacer / retirer / demain).
    if (err instanceof SoldOutTodayError) {
      return checkoutError(409, 'SOLD_OUT_TODAY', err.message, {
        items: err.lines,
      });
    }
    console.error('[POST /api/commandes]', err);
    return checkoutError(500, 'SERVER_ERROR', 'Erreur serveur');
  }
}
