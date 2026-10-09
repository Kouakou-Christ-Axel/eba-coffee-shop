// Mutations de commandes — pay-and-complete.

import type { UserRole } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { canTogglePayment } from '@/lib/order-permissions';
import { formatPickup, isDeferredPickup } from '@/lib/orders/scheduling';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { OrderMutationError, StockShortageError } from './errors';
import {
  reserveStockOnce,
  notifyPendingOrdersOfShortage,
} from './stock-reservation';
import { resolvePaymentMode } from './payment-mode';

/**
 * Finalise une commande en un seul geste : la marque payée (si elle ne l'est pas
 * déjà) ET la passe `COMPLETED` (récupérée). Raccourci caisse pour un walk-in qui
 * paie et repart, sans dérouler NEW → PREPARING → READY → COMPLETED.
 *
 * NEW → COMPLETED n'est pas une transition `canTransition` classique : on contrôle
 * donc directement le rôle (`canTogglePayment`) et on écrit dans une transaction
 * atomique avec garde de concurrence sur `status` ET `isPaid`.
 *
 * STOCK : réservation INCONDITIONNELLE via `reserveStockOnce`, dans la même
 * transaction. NEW → COMPLETED ne passe jamais par `PREPARING`, mais la
 * marchandise est bel et bien servie : elle doit donc être décomptée. Aucune
 * garde sur `alreadyPaid` ni sur `status !== 'COMPLETED'` — le verrou
 * `stockReservedAt` les rend inutiles ET strictement plus correctes : une
 * commande déjà passée en cuisine ne sera pas décomptée deux fois, tandis
 * qu'une commande `COMPLETED` qui n'a jamais rien réservé (cas que les
 * anciennes gardes laissaient filer) l'est enfin.
 *
 * `payments` (1..N lignes `{mode, amount}`, somme = total relu en base) n'est
 * requis QUE si la commande n'est pas déjà payée ; ignoré (la commande garde
 * ses lignes `OrderPayment` existantes) si `alreadyPaid`.
 *
 * COMMANDE DIFFÉRÉE : refusée (409). « Payer + récupérer » affirme que le client
 * emporte la marchandise maintenant — ce qui est faux pour un retrait prévu un
 * autre jour, et décompterait le stock du jour pour rien. La garde porte sur
 * `stockReservedAt` et non sur le statut : une commande différée PRÉPARÉE EN
 * AVANCE (donc déjà réservée) peut légitimement être remise et encaissée en un
 * geste. L'interface masque le bouton dans le cas refusé ; ce garde-fou existe
 * pour les appels directs à l'API.
 *
 * Lève `OrderMutationError` (400 paiement manquant/somme incorrecte si pas déjà
 * payée, 403 rôle, 404 introuvable, 409 conflit/déjà finale/retrait différé, ou
 * `StockShortageError` 409 si le stock ne suffit plus — le client perdant est
 * alors notifié `ITEM_UNAVAILABLE` avant que l'erreur ne remonte).
 * Renvoie `alreadyPaid` (vrai si la commande était déjà encaissée avant l'appel).
 */
export async function payAndComplete(
  id: string,
  payments: OrderPaymentLineInput[] | undefined,
  role: UserRole,
  actorId?: string | null,
  opts?: { coverShortage?: boolean }
): Promise<{ alreadyPaid: boolean }> {
  if (!canTogglePayment(role)) {
    throw new OrderMutationError('Action réservée à la caisse', 403);
  }

  const now = new Date();
  let txResult: { alreadyPaid: boolean; reserved: boolean; items: CartItem[] };
  try {
    txResult = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        select: {
          status: true,
          isPaid: true,
          items: true,
          total: true,
          pickupTime: true,
          stockReservedAt: true,
          depositPaid: true,
          depositRequired: true,
        },
      });
      if (!order) {
        throw new OrderMutationError('Commande introuvable', 404);
      }
      if (order.status === 'CANCELLED') {
        throw new OrderMutationError('Commande annulée', 409);
      }
      if (order.status === 'COMPLETED' && order.isPaid) {
        throw new OrderMutationError('Commande déjà finalisée', 409);
      }
      if (
        order.stockReservedAt === null &&
        isDeferredPickup(order.pickupTime, now)
      ) {
        throw new OrderMutationError(
          `Retrait prévu ${formatPickup(order.pickupTime as Date, now)} : encaissez la commande, elle sera remise le jour du retrait. ` +
            'Pour la remettre maintenant, modifiez d’abord le créneau de retrait.',
          409
        );
      }

      const alreadyPaid = order.isPaid;
      const items = order.items as unknown as CartItem[];

      if (!alreadyPaid) {
        if (!payments || payments.length === 0) {
          throw new OrderMutationError(
            'payments requis pour encaisser cette commande',
            400
          );
        }
        // Un acompte déjà versé (cf. `recordDeposit`) compte comme déjà réglé :
        // ce geste ne porte que sur le solde restant.
        const expected = order.total - (order.depositPaid ?? 0);
        const sum = payments.reduce((s, p) => s + p.amount, 0);
        if (sum !== expected) {
          throw new OrderMutationError(
            `Le total des paiements (${sum} F) ne correspond pas au solde de la commande (${expected} F)`,
            400
          );
        }
      }

      // Inconditionnel : NEW → COMPLETED court-circuite PREPARING, mais la
      // marchandise part quand même. Le verrou d'idempotence garantit qu'une
      // commande déjà passée en cuisine n'est pas décomptée une seconde fois.
      const reserved = await reserveStockOnce(tx, id, items, {
        coverShortage: opts?.coverShortage,
      });

      const result = await tx.order.updateMany({
        // Garde optimiste sur les deux champs lus : un autre caissier peut avoir
        // encaissé ou avancé la commande entre la lecture et l'écriture.
        where: { id, status: order.status, isPaid: order.isPaid },
        data: {
          status: 'COMPLETED',
          // Ne pas écraser le mode / l'horodatage d'une commande déjà payée.
          ...(alreadyPaid
            ? {}
            : {
                isPaid: true,
                paymentMode: resolvePaymentMode(
                  payments as OrderPaymentLineInput[]
                ),
                paidAt: new Date(),
                // Même règle que `setOrderPayment` : un règlement intégral
                // couvre toujours l'acompte, puisqu'il couvre le total.
                ...(order.depositRequired != null
                  ? { depositPaid: order.total, depositPaidAt: new Date() }
                  : {}),
              }),
        },
      });

      if (result.count === 0) {
        throw new OrderMutationError(
          'État modifié entre temps, recharger',
          409
        );
      }

      if (!alreadyPaid) {
        await tx.orderPayment.createMany({
          data: (payments as OrderPaymentLineInput[]).map((p) => ({
            orderId: id,
            mode: p.mode,
            amount: p.amount,
            createdById: actorId ?? null,
          })),
        });
      }

      return { alreadyPaid, reserved, items };
    });
  } catch (err) {
    if (err instanceof StockShortageError) {
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  // Après la transaction seulement (jamais dedans) : commande soldée et
  // récupérée en un geste → dernière notification client, puis désabonnement.
  notifyOrderCustomer(id, 'COMPLETED');

  // Fan-out best-effort (uniquement si CET appel a décrémenté du stock) :
  // avertir tout de suite les autres clients dont la commande en attente
  // dépend d'un produit/option qui vient de tomber à 0.
  if (txResult.reserved) {
    notifyPendingOrdersOfShortage(id, txResult.items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }

  return { alreadyPaid: txResult.alreadyPaid };
}
