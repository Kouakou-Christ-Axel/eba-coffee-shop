// lib/loyalty-mutations.ts
//
// Attribution des tampons (carte à tampons) et ajustement manuel. L'attribution
// tourne DANS la transaction de création de commande (atomique avec l'order).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { todayDailyDate } from '@/lib/daily-numbering';
import { loyaltySettingsFromRow } from '@/lib/loyalty-settings';
import { computeStampAward } from '@/lib/loyalty-compute';

type AwardArgs = {
  customerId: string;
  orderId: string;
  orderTotal: number;
  /** Utilisateur à l'origine (caisse) ; null pour une commande en ligne. */
  actorId?: string | null;
};

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
      data: { customerId, tier: r.tier, capAmount: r.capAmount, earnedOrderId: orderId },
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
