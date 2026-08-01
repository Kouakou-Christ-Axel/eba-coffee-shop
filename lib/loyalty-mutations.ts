// lib/loyalty-mutations.ts
//
// Attribution des tampons (carte à tampons) et ajustement manuel. L'attribution
// tourne DANS la transaction de création de commande (atomique avec l'order).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { todayDailyDate } from '@/lib/daily-numbering';
import { loyaltySettingsFromRow } from '@/lib/loyalty-settings';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { computeStampAward, type EarnedReward } from '@/lib/loyalty-compute';

type AwardArgs = {
  customerId: string;
  orderId: string;
  orderTotal: number;
  /** Utilisateur à l'origine (caisse) ; null pour une commande en ligne. */
  actorId?: string | null;
};

/**
 * Récompense demandée mais inutilisable : introuvable, appartenant à un autre
 * client, ou déjà consommée. Les appelants (caisse, API publique) traduisent
 * vers leur format d'erreur (OrderMutationError 400 / réponse HTTP 400).
 */
export class LoyaltyRewardUnavailableError extends Error {
  constructor(message = 'Récompense fidélité indisponible') {
    super(message);
    this.name = 'LoyaltyRewardUnavailableError';
  }
}

/**
 * Vérifie qu'une récompense est utilisable par le client résolu de la
 * commande : elle doit exister, lui appartenir et être `AVAILABLE`. À appeler
 * DANS la transaction de création (revérifiée à chaque tentative de retry —
 * une transaction annulée n'a rien écrit). Lève
 * `LoyaltyRewardUnavailableError` sinon.
 */
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

/**
 * Consomme une récompense pour une commande créée : statut `USED` +
 * `usedOrderId`/`usedAt`, et trace `REWARD_USED` au ledger. MÊME transaction
 * que la création — jamais réutilisable deux fois.
 *
 * `redeemedAsGift` : la récompense part en cadeau (produit/geste offert au
 * comptoir) plutôt qu'en réduction numéraire — le statut passe quand même à
 * `USED` (elle ne peut plus resservir), mais c'est à l'appelant de NE PAS
 * déduire `capAmount` du total de la commande dans ce mode (cf.
 * `setOrderLoyaltyReward` / `createCashierOrder`).
 */
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

/**
 * Attribue (au plus) 1 tampon pour une commande, et crée les récompenses
 * débloquées. Respecte : programme actif, montant min, et 1 tampon/jour/numéro.
 * No-op silencieux si une condition n'est pas remplie.
 */
export async function awardLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  { customerId, orderId, orderTotal, actorId }: AwardArgs
): Promise<void> {
  const settings = loyaltySettingsFromRow(
    await tx.loyaltySettings.findUnique({ where: { id: 'singleton' } })
  );
  if (!settings.enabled) return;
  if (orderTotal < settings.minOrderAmount) return;

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { stampCount: true, lastStampDate: true },
  });
  if (!customer) return;

  const today = todayDailyDate();
  if (
    settings.oneStampPerDay &&
    customer.lastStampDate &&
    customer.lastStampDate.getTime() === today.getTime()
  ) {
    return; // déjà un tampon aujourd'hui
  }

  const { newStampCount, rewards } = computeStampAward(
    customer.stampCount,
    settings
  );

  await tx.customer.update({
    where: { id: customerId },
    data: { stampCount: newStampCount, lastStampDate: today },
  });
  await tx.loyaltyLedger.create({
    data: {
      customerId,
      type: 'STAMP_EARNED',
      stamps: 1,
      orderId,
      actorId: actorId ?? null,
    },
  });

  for (const r of rewards) {
    await tx.loyaltyReward.create({
      data: {
        customerId,
        tier: r.tier,
        capAmount: r.capAmount,
        earnedOrderId: orderId,
      },
    });
    await tx.loyaltyLedger.create({
      data: {
        customerId,
        type: 'REWARD_EARNED',
        orderId,
        actorId: actorId ?? null,
        note: `Palier ${r.tier} — ${r.capAmount} F`,
      },
    });
  }
}

/** Ajustement manuel (admin) du compteur de tampons. Tracé au ledger. */
export async function adjustStamps(
  customerId: string,
  delta: number,
  note?: string | null,
  actorId?: string | null
): Promise<number> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { stampCount: true },
  });
  if (!customer) throw new Error('Client introuvable');

  const next = Math.max(0, customer.stampCount + delta);
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customerId },
      data: { stampCount: next },
    }),
    prisma.loyaltyLedger.create({
      data: {
        customerId,
        type: 'ADJUSTMENT',
        stamps: delta,
        note: note ?? null,
        actorId: actorId ?? null,
      },
    }),
  ]);
  return next;
}

/**
 * Rattrapage de `count` commandes non enregistrées (paiement cash oublié en
 * caisse, etc.) : simule `count` tampons via `computeStampAward`, en
 * débloquant les récompenses de palier comme le ferait une vraie commande.
 * Contrairement à `awardLoyaltyForOrder`, ignore `minOrderAmount` et
 * `oneStampPerDay` (rattrapage a posteriori décidé par un admin, pas une
 * attribution en temps réel).
 */
export async function awardMissedOrderStamps(
  customerId: string,
  count: number,
  note?: string | null,
  actorId?: string | null
): Promise<{ stampCount: number; rewardsCreated: number }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { stampCount: true },
  });
  if (!customer) throw new Error('Client introuvable');

  const settings = await getLoyaltySettings();

  let stampCount = customer.stampCount;
  const rewards: EarnedReward[] = [];
  for (let i = 0; i < count; i++) {
    const result = computeStampAward(stampCount, settings);
    stampCount = result.newStampCount;
    rewards.push(...result.rewards);
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { stampCount },
    });
    await tx.loyaltyLedger.create({
      data: {
        customerId,
        type: 'ADJUSTMENT',
        stamps: count,
        note: note ?? null,
        actorId: actorId ?? null,
      },
    });
    for (const r of rewards) {
      await tx.loyaltyReward.create({
        data: {
          customerId,
          tier: r.tier,
          capAmount: r.capAmount,
        },
      });
      await tx.loyaltyLedger.create({
        data: {
          customerId,
          type: 'REWARD_EARNED',
          actorId: actorId ?? null,
          note: `Palier ${r.tier} — ${r.capAmount} F (rattrapage commande manquée)`,
        },
      });
    }
  });

  return { stampCount, rewardsCreated: rewards.length };
}
