// lib/orders/mutations/loyalty.ts
//
// Mutations de commandes — loyalty (extrait de lib/order-mutations.ts, sans changement de comportement).

import prisma from '@/lib/prisma';
import {
  consumeLoyaltyReward,
  LoyaltyRewardUnavailableError,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
import { computeItemsTotal } from '@/lib/orders/totals';
import type { CartItem } from '@/lib/cart-store';
import { OrderMutationError } from './errors';

// ─── Récompense fidélité sur une commande déjà créée ───────────────────────────

/**
 * Applique (ou retire) une récompense fidélité sur une commande existante —
 * contrairement à `createCashierOrder`, où la récompense ne peut être choisie
 * qu'à la création. Recalcule le total à partir des articles courants (même
 * formule que `updateOrderItems`) et consomme/restitue la récompense en
 * conséquence.
 *
 * `{ loyaltyRewardId: null }` retire la récompense déjà appliquée (si il y en
 * a une) : elle redevient `AVAILABLE`, la remise est retirée du total.
 * `{ loyaltyRewardId: "<id>" }` retire d'abord la précédente s'il y en a une,
 * puis applique la nouvelle (vérifiée : appartient au client de la commande,
 * statut `AVAILABLE`).
 *
 * `redeemAsGift: true` : la récompense est marquée utilisée (elle ne resservira
 * plus) mais SANS déduire `capAmount` du total — pour les clients à qui on
 * offre un geste/produit au comptoir plutôt qu'une réduction en numéraire.
 *
 * Applicable même à une commande TERMINÉE (déjà récupérée/encaissée) : sert
 * à corriger après coup un palier qui aurait dû déclencher la réduction sans
 * que le personnel ne l'ait posée à temps. Seule une commande ANNULÉE reste
 * bloquée. `lib/cash-closing.ts` ne fait pas de snapshot des totaux : modifier
 * une commande terminée change donc rétroactivement le CA lu par les
 * rapports déjà générés — compromis assumé, tracé par le ledger fidélité.
 *
 * Lève `OrderMutationError` (404 commande, 400 récompense indisponible / pas
 * de client associé, 409 commande annulée).
 */
export async function setOrderLoyaltyReward(
  orderId: string,
  input: { loyaltyRewardId: string | null; redeemAsGift?: boolean },
  actorId?: string | null
): Promise<{ total: number; loyaltyDiscount: number | null }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        items: true,
        customerId: true,
        loyaltyRewardId: true,
      },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.status === 'CANCELLED') {
      throw new OrderMutationError(
        'Impossible de modifier une commande annulée',
        409
      );
    }

    // Retire d'abord la récompense déjà appliquée, s'il y en a une : elle
    // redevient disponible pour le client (réappliquer sur cette même
    // commande, ou une autre plus tard).
    if (order.loyaltyRewardId) {
      await tx.loyaltyReward.update({
        where: { id: order.loyaltyRewardId },
        data: {
          status: 'AVAILABLE',
          usedOrderId: null,
          usedAt: null,
          redeemedAsGift: false,
        },
      });
      await tx.loyaltyLedger.create({
        data: {
          customerId: order.customerId as string,
          type: 'ADJUSTMENT',
          orderId,
          actorId: actorId ?? null,
          note: 'Récompense retirée de la commande',
        },
      });
    }

    const grossTotal = computeItemsTotal(order.items as CartItem[]);

    let reward: { id: string; capAmount: number } | null = null;
    if (input.loyaltyRewardId) {
      try {
        reward = await resolveLoyaltyReward(
          tx,
          input.loyaltyRewardId,
          order.customerId
        );
      } catch (err) {
        if (err instanceof LoyaltyRewardUnavailableError) {
          throw new OrderMutationError(err.message, 400);
        }
        throw err;
      }
    }

    const redeemAsGift = Boolean(reward && input.redeemAsGift);
    const discount =
      reward && !redeemAsGift ? Math.min(reward.capAmount, grossTotal) : 0;
    const total = grossTotal - discount;

    const result = await tx.order.updateMany({
      where: { id: orderId, status: { notIn: ['CANCELLED'] } },
      data: {
        total,
        loyaltyRewardId: reward?.id ?? null,
        loyaltyDiscount: discount || null,
      },
    });
    if (result.count === 0) {
      throw new OrderMutationError(
        'État déjà modifié par un autre caissier',
        409
      );
    }

    if (reward) {
      await consumeLoyaltyReward(tx, {
        rewardId: reward.id,
        customerId: order.customerId as string,
        orderId,
        capAmount: reward.capAmount,
        actorId: actorId ?? null,
        redeemedAsGift: redeemAsGift,
      });
    }

    return { total, loyaltyDiscount: discount || null };
  });
}
