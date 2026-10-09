// Mutations de commandes — loyalty.

import prisma from '@/lib/prisma';
import {
  consumeLoyaltyReward,
  LoyaltyRewardUnavailableError,
  resolveLoyaltyReward,
} from '@/lib/loyalty-mutations';
import { computeItemsTotal } from '@/lib/orders/totals';
import type { CartItem } from '@/lib/cart-store';
import { OrderMutationError } from './errors';

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
