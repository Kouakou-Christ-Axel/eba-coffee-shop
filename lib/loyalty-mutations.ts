// lib/loyalty-mutations.ts
//
// Attribution des tampons (carte à tampons) et ajustement manuel. L'attribution
// tourne DANS la transaction de création de commande (atomique avec l'order).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { todayDailyDate } from '@/lib/daily-numbering';
import { loyaltySettingsFromRow } from '@/lib/loyalty-settings';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import {
  computeStampAward,
  computeStampRevert,
  type EarnedReward,
} from '@/lib/loyalty-compute';

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

/** Récompense (palier) débloquée par une commande, avec l'id de la ligne créée. */
export type EarnedRewardRow = EarnedReward & { id: string };

/**
 * Attribue (au plus) 1 tampon pour une commande, et crée les récompenses
 * débloquées. Respecte : programme actif, montant min, et 1 tampon/jour/numéro.
 * No-op silencieux si une condition n'est pas remplie.
 *
 * Renvoie les récompenses débloquées PAR CETTE COMMANDE (id compris) : elles
 * sont `AVAILABLE` mais n'ont pas encore été appliquées à une commande —
 * l'appelant (caisse/en ligne) peut les auto-appliquer à la commande qui
 * vient elle-même de les débloquer (cf. `createCashierOrder` / `createOrder`).
 */
export async function awardLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  { customerId, orderId, orderTotal, actorId }: AwardArgs
): Promise<{ rewards: EarnedRewardRow[] }> {
  const settings = loyaltySettingsFromRow(
    await tx.loyaltySettings.findUnique({ where: { id: 'singleton' } })
  );
  if (!settings.enabled) return { rewards: [] };
  if (orderTotal < settings.minOrderAmount) return { rewards: [] };

  const customer = await tx.customer.findUnique({
    where: { id: customerId },
    select: { stampCount: true, lastStampDate: true },
  });
  if (!customer) return { rewards: [] };

  const today = todayDailyDate();
  if (
    settings.oneStampPerDay &&
    customer.lastStampDate &&
    customer.lastStampDate.getTime() === today.getTime()
  ) {
    return { rewards: [] }; // déjà un tampon aujourd'hui
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

  const createdRewards: EarnedRewardRow[] = [];
  for (const r of rewards) {
    const created = await tx.loyaltyReward.create({
      data: {
        customerId,
        tier: r.tier,
        capAmount: r.capAmount,
        earnedOrderId: orderId,
      },
    });
    createdRewards.push({
      tier: r.tier,
      capAmount: r.capAmount,
      id: created.id,
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

  return { rewards: createdRewards };
}

/** Solde de tampons tracé au ledger pour UNE commande (+1 à l'attribution,
 * −1 à chaque retrait). Rend les retraits/restitutions idempotents : annuler,
 * rétablir, ré-annuler ne retire jamais deux fois le même tampon. */
async function orderStampBalance(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ net: number; everEarned: boolean }> {
  const rows = await tx.loyaltyLedger.findMany({
    where: { orderId, type: { in: ['STAMP_EARNED', 'ADJUSTMENT'] } },
    select: { type: true, stamps: true },
  });
  return {
    net: rows.reduce((sum, r) => sum + r.stamps, 0),
    everEarned: rows.some((r) => r.type === 'STAMP_EARNED'),
  };
}

/**
 * Défait, DANS la transaction d'annulation, tout ce que la commande a produit
 * côté fidélité — sans quoi « commander puis annuler » deviendrait une ferme à
 * tampons :
 *   1. la récompense utilisée SUR cette commande redevient disponible (le
 *      client ne la perd pas pour une commande qui n'a pas eu lieu) ;
 *   2. les récompenses débloquées PAR cette commande sont supprimées — sauf
 *      si le client en a déjà profité sur une AUTRE commande : on la lui
 *      laisse (le geste est fait) et on le trace ;
 *   3. le tampon gagné est retiré (`computeStampRevert`), et la règle « un
 *      tampon par jour » est relâchée si ce tampon était celui du jour.
 * Tout est tracé au ledger (`ADJUSTMENT`). No-op si la commande n'avait rien
 * produit (ou si c'est déjà défait : idempotent).
 *
 * `keepUsedReward` (annulation par le STAFF) : la récompense appliquée à la
 * commande y reste attachée — la commande a pu être encaissée avec cette
 * remise, et une annulation peut être défaite ; on ne touche qu'au tampon et
 * aux récompenses débloquées encore disponibles.
 */
export async function revokeLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    customerId: string;
    /** Récompense appliquée à la commande (`Order.loyaltyRewardId`). */
    usedRewardId: string | null;
    note: string;
    actorId?: string | null;
    keepUsedReward?: boolean;
  }
): Promise<void> {
  const { orderId, customerId, note } = args;
  const actorId = args.actorId ?? null;

  const earned = await tx.loyaltyReward.findMany({
    where: { earnedOrderId: orderId },
    select: { id: true, status: true, usedOrderId: true, capAmount: true },
  });
  const earnedIds = new Set(earned.map((r) => r.id));

  // 1. Récompense utilisée sur cette commande (et non débloquée par elle).
  if (
    !args.keepUsedReward &&
    args.usedRewardId &&
    !earnedIds.has(args.usedRewardId)
  ) {
    await tx.loyaltyReward.update({
      where: { id: args.usedRewardId },
      data: {
        status: 'AVAILABLE',
        usedOrderId: null,
        usedAt: null,
        redeemedAsGift: false,
      },
    });
    await tx.loyaltyLedger.create({
      data: {
        customerId,
        type: 'ADJUSTMENT',
        orderId,
        actorId,
        note: `${note} — récompense restituée`,
      },
    });
  }

  // 2. Récompenses débloquées par cette commande.
  for (const r of earned) {
    const usedElsewhere =
      r.status === 'USED' &&
      r.usedOrderId !== null &&
      r.usedOrderId !== orderId;
    const keptOnThisOrder =
      args.keepUsedReward && r.status === 'USED' && r.usedOrderId === orderId;
    if (keptOnThisOrder) continue;
    if (usedElsewhere) {
      await tx.loyaltyLedger.create({
        data: {
          customerId,
          type: 'ADJUSTMENT',
          orderId,
          actorId,
          note: `${note} — récompense ${r.capAmount} F déjà utilisée sur une autre commande, conservée`,
        },
      });
      continue;
    }
    await tx.loyaltyReward.delete({ where: { id: r.id } });
    await tx.loyaltyLedger.create({
      data: {
        customerId,
        type: 'ADJUSTMENT',
        orderId,
        actorId,
        note: `${note} — récompense ${r.capAmount} F retirée`,
      },
    });
  }

  // 3. Tampon gagné par cette commande — seulement s'il est encore compté.
  const { net } = await orderStampBalance(tx, orderId);
  if (net > 0) {
    const [customer, settingsRow] = await Promise.all([
      tx.customer.findUnique({
        where: { id: customerId },
        select: { stampCount: true, lastStampDate: true },
      }),
      tx.loyaltySettings.findUnique({ where: { id: 'singleton' } }),
    ]);
    if (customer) {
      const settings = loyaltySettingsFromRow(settingsRow);
      const today = todayDailyDate();
      await tx.customer.update({
        where: { id: customerId },
        data: {
          stampCount: computeStampRevert(customer.stampCount, settings),
          ...(customer.lastStampDate?.getTime() === today.getTime()
            ? { lastStampDate: null }
            : {}),
        },
      });
      await tx.loyaltyLedger.create({
        data: {
          customerId,
          type: 'ADJUSTMENT',
          stamps: -1,
          orderId,
          actorId,
          note,
        },
      });
    }
  }
}

/**
 * Inverse de `revokeLoyaltyForOrder` quand le STAFF rétablit une commande
 * annulée : si son tampon avait été retiré, on le lui ré-attribue selon les
 * règles normales (`awardLoyaltyForOrder` : programme actif, montant min,
 * un tampon par jour). Idempotent : no-op si le tampon est déjà compté, ou si
 * la commande n'en avait jamais gagné.
 */
export async function restoreLoyaltyForOrder(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    customerId: string;
    orderTotal: number;
    actorId?: string | null;
  }
): Promise<void> {
  const { net, everEarned } = await orderStampBalance(tx, args.orderId);
  if (!everEarned || net > 0) return;
  await awardLoyaltyForOrder(tx, {
    customerId: args.customerId,
    orderId: args.orderId,
    orderTotal: args.orderTotal,
    actorId: args.actorId ?? null,
  });
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
