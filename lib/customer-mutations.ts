// lib/customer-mutations.ts
//
// Rattachement / création d'un client (CRM) au fil des commandes. Le client est
// identifié par son téléphone normalisé (clé canonique). Appelé DANS la
// transaction de création de commande pour rester atomique.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import {
  customerInputSchema,
  customerMergeSchema,
  customerUpdateSchema,
} from '@/lib/schemas/customer';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { computeStampAward } from '@/lib/loyalty-compute';

/**
 * Upsert d'un client à partir du téléphone d'une commande, et renvoie son `id`
 * (ou null si aucun téléphone exploitable → commande anonyme). Met à jour le
 * `name` avec le dernier nom connu quand il est fourni.
 */
export async function upsertCustomerForOrder(
  tx: Prisma.TransactionClient,
  rawPhone: string | null | undefined,
  name: string | null | undefined
): Promise<string | null> {
  const key = customerPhoneKey(rawPhone);
  if (!key) return null;

  const cleanName = name?.trim() || null;
  const customer = await tx.customer.upsert({
    where: { phone: key },
    create: { phone: key, name: cleanName },
    update: cleanName ? { name: cleanName } : {},
  });
  return customer.id;
}

// ─── CRM : création / modification directe d'un client ─────────────────────────

/**
 * Crée un client (CRM). Le téléphone est normalisé en clé canonique ; un doublon
 * (même numéro) est refusé avec un message lisible.
 */
export async function createCustomer(input: unknown) {
  const data = customerInputSchema.parse(input);
  const key = customerPhoneKey(data.phone);
  if (!key) throw new Error('Numéro de téléphone invalide.');
  try {
    return await prisma.customer.create({
      data: { phone: key, name: data.name?.trim() || null },
    });
  } catch (err) {
    throw rethrowDuplicatePhone(err);
  }
}

/**
 * Met à jour un client (nom et/ou téléphone). Mise à jour partielle : seuls les
 * champs fournis changent. Le téléphone reste unique.
 */
export async function updateCustomer(id: string, input: unknown) {
  const data = customerUpdateSchema.parse(input);
  const patch: Prisma.CustomerUpdateInput = {};
  if (data.name !== undefined) patch.name = data.name?.trim() || null;
  if (data.phone !== undefined) {
    const key = customerPhoneKey(data.phone);
    if (!key) throw new Error('Numéro de téléphone invalide.');
    patch.phone = key;
  }
  try {
    return await prisma.customer.update({ where: { id }, data: patch });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new Error('Client introuvable.');
    }
    throw rethrowDuplicatePhone(err);
  }
}

export type CustomerMergeResult = {
  customer: Awaited<ReturnType<typeof prisma.customer.update>>;
  ordersMoved: number;
  rewardsMoved: number;
  ledgerMoved: number;
  pollVotesMoved: number;
  stampsMerged: number;
};

/**
 * Fusionne `sourceId` dans `targetId` (deux comptes créés par erreur pour le
 * même client, ex. saisie sur deux numéros différents) : commandes,
 * récompenses, journal de fidélité et votes de sondage de la source sont
 * re-rattachés à la cible ; l'avancement de sa carte à tampons est rejoué sur
 * la cible via `computeStampAward` (mêmes paliers/récompenses qu'un
 * rattrapage — cf. `awardMissedOrderStamps`) ; la source est ensuite
 * supprimée. Le numéro de téléphone conservé est celui de `targetId`.
 */
export async function mergeCustomers(
  input: unknown,
  actorId?: string | null
): Promise<CustomerMergeResult> {
  const { sourceId, targetId } = customerMergeSchema.parse(input);
  const settings = await getLoyaltySettings();

  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.customer.findUnique({ where: { id: sourceId } }),
      tx.customer.findUnique({ where: { id: targetId } }),
    ]);
    if (!source) throw new Error('Client source introuvable.');
    if (!target) throw new Error('Client cible introuvable.');

    const [orders, rewards, ledger, pollVotes] = await Promise.all([
      tx.order.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
      tx.loyaltyReward.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
      tx.loyaltyLedger.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
      tx.pollVote.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      }),
    ]);

    let stampCount = target.stampCount;
    for (let i = 0; i < source.stampCount; i++) {
      const result = computeStampAward(stampCount, settings);
      stampCount = result.newStampCount;
      for (const r of result.rewards) {
        await tx.loyaltyReward.create({
          data: { customerId: targetId, tier: r.tier, capAmount: r.capAmount },
        });
        await tx.loyaltyLedger.create({
          data: {
            customerId: targetId,
            type: 'REWARD_EARNED',
            actorId: actorId ?? null,
            note: `Palier ${r.tier} — ${r.capAmount} F (fusion depuis ${source.phone})`,
          },
        });
      }
    }
    if (source.stampCount > 0) {
      await tx.loyaltyLedger.create({
        data: {
          customerId: targetId,
          type: 'ADJUSTMENT',
          stamps: source.stampCount,
          actorId: actorId ?? null,
          note: `Fusion du compte ${source.phone}`,
        },
      });
    }

    const lastStampDate =
      target.lastStampDate && source.lastStampDate
        ? target.lastStampDate > source.lastStampDate
          ? target.lastStampDate
          : source.lastStampDate
        : (target.lastStampDate ?? source.lastStampDate);

    const merged = await tx.customer.update({
      where: { id: targetId },
      data: { stampCount, lastStampDate, name: target.name ?? source.name },
    });

    await tx.customer.delete({ where: { id: sourceId } });

    return {
      customer: merged,
      ordersMoved: orders.count,
      rewardsMoved: rewards.count,
      ledgerMoved: ledger.count,
      pollVotesMoved: pollVotes.count,
      stampsMerged: source.stampCount,
    };
  });
}

function rethrowDuplicatePhone(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Un client utilise déjà ce numéro de téléphone.');
  }
  return err;
}
