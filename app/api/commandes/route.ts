// app/api/commandes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createOrder, createOrderSchema } from '@/lib/orders';
import { sendNewOrderEmail } from '@/lib/email';
import { PAYMENT_EXPIRY_MINUTES } from '@/config/constants';
import { jekoConfig, onlineFeePercent } from '@/lib/jeko/config';
import { expirePendingOrders } from '@/lib/jeko/expiry';
import { startJekoPayment } from '@/lib/jeko/start-payment';
import { getMenuAdmin } from '@/lib/menu';
import { siteUrl } from '@/lib/site-url';
import { revalidatePublicMenu } from '@/lib/revalidate-public-menu';
import type { CartItem } from '@/lib/cart-store';
import {
  publicOrderError,
  publicOrderErrorResponse,
} from '@/lib/orders/public-error-response';
import {
  allowOrderCreate,
  orderCreateRateKey,
} from '@/lib/order-create-rate-limit';

// Réponses d'erreur : toujours un `code` stable (voir `checkoutErrorCodeSchema`,
// lib/schemas/order.ts) — le client aiguille dessus, le `error` reste le
// message lisible. Mapping partagé avec les routes publiques de la page de suivi.

export async function POST(req: NextRequest) {
  if (!allowOrderCreate(orderCreateRateKey(req))) {
    return publicOrderError(
      429,
      'RATE_LIMITED',
      'Trop de commandes : réessaie dans quelques minutes.'
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicOrderError(400, 'INVALID_BODY', 'Corps de requête invalide');
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return publicOrderError(400, 'VALIDATION', parsed.error.flatten());
  }

  // Nettoyage opportuniste des commandes en attente expirées (pas de cron) : une
  // nouvelle commande est le signe que le site vit, donc un bon moment. Jamais
  // bloquant — la réponse n'en dépend pas.
  void expirePendingOrders().catch(() => {});

  // Paiement en ligne (Jèko) : actif dès que sa config est complète ; sinon la
  // commande suit le flux historique, inchangé.
  const jeko = jekoConfig();
  const { paymentMethod } = parsed.data;
  if (jeko && !paymentMethod) {
    return publicOrderError(400, 'VALIDATION', {
      fieldErrors: { paymentMethod: ['Choisis un moyen de paiement'] },
    });
  }

  try {
    const order = await createOrder(
      parsed.data,
      jeko
        ? {
            onlinePayment: {
              feePercent: onlineFeePercent(),
              expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60_000),
              menu: await getMenuAdmin(),
            },
          }
        : undefined
    );

    // Un paiement en ligne pour aujourd'hui réserve le stock dès la création :
    // la carte doit le refléter sans attendre l'ISR.
    if (jeko) revalidatePublicMenu();

    // Commande en attente de paiement : le paiement démarre ici, et le staff
    // n'en est informé qu'au règlement (lib/jeko/settle.ts).
    if (jeko && paymentMethod && order.paymentExpiresAt) {
      try {
        const payment = await startJekoPayment({
          orderId: order.id,
          paymentMethod,
          config: jeko,
          siteUrl: siteUrl(),
        });
        return NextResponse.json(
          {
            id: order.id,
            reference: order.reference,
            paymentUrl: payment.redirectUrl,
            expiresAt: payment.expiresAt.toISOString(),
          },
          { status: 201 }
        );
      } catch (err) {
        // La commande existe : on la rend quand même, sans URL. Le client
        // arrive sur la page de suivi, où « Réessayer » relance le paiement.
        console.error('[POST /api/commandes] démarrage du paiement :', err);
        return NextResponse.json(
          {
            id: order.id,
            reference: order.reference,
            paymentUrl: null,
            paymentError: 'PAYMENT_PROVIDER_ERROR',
          },
          { status: 201 }
        );
      }
    }

    sendNewOrderEmail({
      ...order,
      items: order.items as CartItem[],
    }).catch((err) => {
      console.error('[email] Échec notification propriétaire :', err);
    });
    return NextResponse.json(
      { id: order.id, reference: order.reference, paymentUrl: null },
      { status: 201 }
    );
  } catch (err) {
    return publicOrderErrorResponse(err, 'POST /api/commandes');
  }
}
