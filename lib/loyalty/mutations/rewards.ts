import { Prisma } from '@/generated/prisma/client';
import { LoyaltyRewardUnavailableError } from './errors';

export async function resolveLoyaltyReward(
  tx: Prisma.TransactionClient,
  rewardId: string,
  customerId: string | null
): Promise<{ id: string; capAmount: number }> {
  if (!customerId) {
    throw new LoyaltyRewardUnavailableError(
      'Récompense fidélité : aucun client associé à la commande'
    );
  }
  const found = await tx.loyaltyReward.findUnique({
    where: { id: rewardId },
    select: { id: true, customerId: true, capAmount: true, status: true },
  });
  if (
    !found ||
    found.customerId !== customerId ||
    found.status !== 'AVAILABLE'
  ) {
    throw new LoyaltyRewardUnavailableError();
  }
  return { id: found.id, capAmount: found.capAmount };
}

export async function consumeLoyaltyReward(
  tx: Prisma.TransactionClient,
  args: {
    rewardId: string;
    customerId: string;
    orderId: string;
    capAmount: number;
    /** Utilisateur caisse à l'origine ; null pour une commande en ligne. */
    actorId?: string | null;
    redeemedAsGift?: boolean;
  }
): Promise<void> {
  await tx.loyaltyReward.update({
    where: { id: args.rewardId },
    data: {
      status: 'USED',
      usedOrderId: args.orderId,
      usedAt: new Date(),
      redeemedAsGift: args.redeemedAsGift ?? false,
    },
  });
  await tx.loyaltyLedger.create({
    data: {
      customerId: args.customerId,
      type: 'REWARD_USED',
      orderId: args.orderId,
      actorId: args.actorId ?? null,
      note: args.redeemedAsGift
        ? `Récompense ${args.capAmount} F offerte en cadeau (sans réduction)`
        : `Récompense ${args.capAmount} F utilisée`,
    },
  });
}
