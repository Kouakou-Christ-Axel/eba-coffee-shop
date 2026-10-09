// Mutations de commandes — payment.

import prisma from '@/lib/prisma';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { notifyKitchen } from './notify';
import { OrderMutationError, StockShortageError } from './errors';
import {
  reserveStockOnce,
  notifyPendingOrdersOfShortage,
} from './stock-reservation';
import { resolvePaymentMode } from './payment-mode';

/** Bascule l'état de paiement d'une commande. */
export async function setOrderPayment(
  id: string,
  isPaid: boolean,
  payments?: OrderPaymentLineInput[],
  actorId?: string | null,
  opts?: {
    coverShortage?: boolean;
    /** Encaisse sans pousser la commande en cuisine (ni réserver de stock). */
    skipKitchen?: boolean;
    online?: {
      gatewayFee: number;
      paymentRequestId?: string;
      paymentTransactionId: string;
    };
  }
): Promise<{ startedPreparation: boolean }> {
  if (isPaid && (!payments || payments.length === 0)) {
    throw new OrderMutationError('payments requis quand isPaid=true', 400);
  }

  if (!isPaid) {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { isPaid: true },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.isPaid === isPaid) {
      throw new OrderMutationError('État de paiement déjà à jour', 409);
    }

    const [result] = await prisma.$transaction([
      prisma.order.updateMany({
        where: { id, isPaid: true },
        data: {
          isPaid: false,
          paymentMode: null,
          paidAt: null,
          paymentAutoValidatedByAi: false,
          depositPaid: 0,
          depositPaidAt: null,
        },
      }),
      prisma.orderPayment.deleteMany({ where: { orderId: id } }),
    ]);
    if (result.count === 0) {
      throw new OrderMutationError('État modifié entre temps, recharger', 409);
    }

    return { startedPreparation: false };
  }

  const now = new Date();
  let txResult: {
    startedPreparation: boolean;
    reserved: boolean;
    items: CartItem[];
    dailyNumber: number;
    reference: string;
  };
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          isPaid: true,
          status: true,
          items: true,
          total: true,
          dailyNumber: true,
          reference: true,
          pickupTime: true,
          depositPaid: true,
          depositRequired: true,
        },
      });
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }
      if (order.isPaid) {
        throw new OrderMutationError('État de paiement déjà à jour', 409);
      }

      const alreadyCollected = order.depositPaid ?? 0;
      const expected = order.total - alreadyCollected;
      const lines = payments as OrderPaymentLineInput[];
      const sum = lines.reduce((s, p) => s + p.amount, 0);
      if (sum !== expected) {
        throw new OrderMutationError(
          `Le total des paiements (${sum} F) ne correspond pas au solde de la commande (${expected} F)`,
          400
        );
      }

      const startedPreparation =
        !opts?.skipKitchen &&
        order.status === 'NEW' &&
        !isDeferredPickup(order.pickupTime, now);
      const items = order.items as unknown as CartItem[];

      const reserved = startedPreparation
        ? await reserveStockOnce(tx, id, items, {
            coverShortage: opts?.coverShortage,
          })
        : false;

      const result = await tx.order.updateMany({
        where: {
          id,
          isPaid: false,
          ...(startedPreparation ? { status: 'NEW' as const } : {}),
        },
        data: {
          isPaid: true,
          paymentMode: resolvePaymentMode(lines),
          paidAt: new Date(),
          // Plus aucun chemin automatique par IA : la colonne reste pour
          // l'historique des anciennes commandes (badge et retour arrière caisse).
          paymentAutoValidatedByAi: false,
          paymentExpiresAt: null,
          ...(opts?.online ?? {}),
          ...(order.depositRequired != null
            ? { depositPaid: order.total, depositPaidAt: new Date() }
            : {}),
          ...(startedPreparation
            ? { status: 'PREPARING' as const, preparingStartedAt: new Date() }
            : {}),
        },
      });

      if (result.count === 0) {
        throw new OrderMutationError(
          'État modifié entre temps, recharger',
          409
        );
      }

      await tx.orderPayment.createMany({
        data: lines.map((p) => ({
          orderId: id,
          mode: p.mode,
          amount: p.amount,
          createdById: actorId ?? null,
        })),
      });

      return {
        startedPreparation,
        reserved,
        items,
        dailyNumber: order.dailyNumber,
        reference: order.reference,
      };
    });
  } catch (err) {
    // Règlement Jèko (`opts.online`) : le client a DÉJÀ payé et l'appelant rejoue
    // en `skipKitchen` — lui annoncer « article indisponible » serait faux.
    if (err instanceof StockShortageError && !opts?.online) {
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  notifyOrderCustomer(
    id,
    txResult.startedPreparation ? 'PAYMENT_PREPARING' : 'PAYMENT'
  );

  if (txResult.startedPreparation) {
    notifyKitchen({
      id,
      dailyNumber: txResult.dailyNumber,
      reference: txResult.reference,
      items: txResult.items,
    });
  }

  if (txResult.reserved) {
    notifyPendingOrdersOfShortage(id, txResult.items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }

  return { startedPreparation: txResult.startedPreparation };
}
