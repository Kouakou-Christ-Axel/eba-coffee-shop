// lib/poll-mutations.ts
//
// Écriture pour les sondages (moteur générique de vote). Indépendant de la
// fidélité (lib/loyalty*) : aucune de ces fonctions ne touche le programme de
// tampons — décision produit assumée pour cette première version.

import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import {
  pollInputSchema,
  pollUpdateSchema,
  pollStatusUpdateSchema,
  pollOptionInputSchema,
  pollOptionUpdateSchema,
  pollSuggestionSubmitSchema,
  pollSuggestionModerationSchema,
  castVoteSchema,
} from '@/lib/schemas/poll';

// Les dates transitent en ISO string dans les schémas Zod (un `z.date()` ne
// peut pas être représenté en JSON Schema — cassait `z.toJSONSchema` pour les
// outils MCP). Converties en `Date` uniquement ici, au moment d'écrire.
function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

// ─── Sondage ────────────────────────────────────────────────────────────────

export async function createPoll(input: unknown, createdById?: string) {
  const data = pollInputSchema.parse(input);
  return prisma.poll.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      allowSuggestions: data.allowSuggestions,
      resultsVisibility: data.resultsVisibility,
      opensAt: toDateOrNull(data.opensAt),
      closesAt: toDateOrNull(data.closesAt),
      createdById: createdById ?? null,
      options: {
        create: data.options.map((o, i) => ({
          label: o.label,
          description: o.description ?? null,
          imageUrl: o.imageUrl ?? null,
          sortOrder: i,
        })),
      },
    },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function updatePoll(id: string, input: unknown) {
  const data = pollUpdateSchema.parse(input);
  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) throw new Error('Sondage introuvable');

  const scalar: Prisma.PollUpdateInput = {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.allowSuggestions !== undefined && {
      allowSuggestions: data.allowSuggestions,
    }),
    ...(data.resultsVisibility !== undefined && {
      resultsVisibility: data.resultsVisibility,
    }),
    ...(data.opensAt !== undefined && { opensAt: toDateOrNull(data.opensAt) }),
    ...(data.closesAt !== undefined && {
      closesAt: toDateOrNull(data.closesAt),
    }),
  };

  return prisma.poll.update({ where: { id }, data: scalar });
}

export async function setPollStatus(id: string, input: unknown) {
  const { status } = pollStatusUpdateSchema.parse(input);
  const existing = await prisma.poll.findUnique({ where: { id } });
  if (!existing) throw new Error('Sondage introuvable');
  return prisma.poll.update({ where: { id }, data: { status } });
}

// Suppression dure autorisée uniquement pour un sondage en préparation (DRAFT)
// sans aucun vote — sinon on invite à clôturer plutôt que supprimer (le cycle
// de vie du sondage est déjà couvert par `status`, pas besoin d'un
// `deletedAt` supplémentaire).
export async function deletePoll(id: string) {
  const poll = await prisma.poll.findUnique({
    where: { id },
    include: { _count: { select: { votes: true } } },
  });
  if (!poll) throw new Error('Sondage introuvable');
  if (poll.status !== 'DRAFT' || poll._count.votes > 0) {
    throw new Error(
      'Impossible de supprimer un sondage déjà ouvert/clôturé ou ayant reçu des votes — clôturez-le à la place'
    );
  }
  return prisma.poll.delete({ where: { id } });
}

// ─── Options ──────────────────────────────────────────────────────────────

export async function createPollOption(pollId: string, input: unknown) {
  const data = pollOptionInputSchema.parse(input);
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) throw new Error('Sondage introuvable');

  const existing = await prisma.pollOption.findMany({
    where: { pollId, deletedAt: null },
    select: { id: true },
  });

  return prisma.pollOption.create({
    data: {
      pollId,
      label: data.label,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      sortOrder: existing.length,
    },
  });
}

export async function updatePollOption(id: string, input: unknown) {
  const data = pollOptionUpdateSchema.parse(input);
  const existing = await prisma.pollOption.findUnique({ where: { id } });
  if (!existing) throw new Error('Option introuvable');

  return prisma.pollOption.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    },
  });
}

// Soft delete obligatoire : les votes déjà enregistrés référencent l'option.
export async function deletePollOption(id: string) {
  const existing = await prisma.pollOption.findUnique({ where: { id } });
  if (!existing) throw new Error('Option introuvable');
  return prisma.pollOption.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Réordonne une option d'un cran (haut/bas) DANS son sondage. Copie de
// `moveProduct` (lib/menu-mutations.ts), scope `pollId`.
export async function movePollOption(id: string, direction: 'up' | 'down') {
  const option = await prisma.pollOption.findUnique({
    where: { id },
    select: { pollId: true },
  });
  if (!option) throw new Error('Option introuvable');

  const all = await prisma.pollOption.findMany({
    where: { pollId: option.pollId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((o) => o.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.pollOption.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.pollOption.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

// ─── Suggestions de la communauté ─────────────────────────────────────────

/**
 * Soumission publique (aucune session). Autorisée tant que le sondage
 * accepte les suggestions (`allowSuggestions`) et n'est pas clôturé — la
 * collecte peut avoir lieu pendant que le sondage est encore en préparation
 * (DRAFT), avant l'ouverture du vote.
 */
export async function submitPollSuggestion(pollId: string, input: unknown) {
  const data = pollSuggestionSubmitSchema.parse(input);
  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) throw new Error('Sondage introuvable');
  if (!poll.allowSuggestions) {
    throw new Error('Ce sondage n’accepte pas de suggestions');
  }
  if (poll.status === 'CLOSED') {
    throw new Error('Ce sondage est clôturé');
  }

  return prisma.pollSuggestion.create({
    data: {
      pollId,
      label: data.label,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      submitterPhone: customerPhoneKey(data.submitterPhone),
      submitterName: data.submitterName ?? null,
    },
  });
}

export async function setPollSuggestionImage(id: string, imageUrl: string) {
  const existing = await prisma.pollSuggestion.findUnique({ where: { id } });
  if (!existing) throw new Error('Suggestion introuvable');
  return prisma.pollSuggestion.update({
    where: { id },
    data: { imageUrl },
  });
}

/**
 * Modération admin : approuve (promeut en vraie PollOption) ou rejette (avec
 * motif) une suggestion PENDING. Protégée contre une double modération
 * concurrente (deux admins qui cliquent en même temps).
 */
export async function moderatePollSuggestion(
  id: string,
  input: unknown,
  moderatedById?: string
) {
  const data = pollSuggestionModerationSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.pollSuggestion.findUnique({ where: { id } });
    if (!suggestion) throw new Error('Suggestion introuvable');
    if (suggestion.status !== 'PENDING') {
      throw new Error('Suggestion déjà modérée');
    }

    if (data.decision === 'reject') {
      return tx.pollSuggestion.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: data.rejectionReason ?? null,
          moderatedById: moderatedById ?? null,
          moderatedAt: new Date(),
        },
      });
    }

    const existingOptions = await tx.pollOption.findMany({
      where: { pollId: suggestion.pollId, deletedAt: null },
      select: { id: true },
    });

    await tx.pollOption.create({
      data: {
        pollId: suggestion.pollId,
        label: suggestion.label,
        description: suggestion.description,
        imageUrl: suggestion.imageUrl,
        sortOrder: existingOptions.length,
        sourceSuggestionId: suggestion.id,
      },
    });

    return tx.pollSuggestion.update({
      where: { id },
      data: {
        status: 'APPROVED',
        moderatedById: moderatedById ?? null,
        moderatedAt: new Date(),
      },
    });
  });
}

// ─── Vote ──────────────────────────────────────────────────────────────────

/**
 * Enregistre (ou modifie) le bulletin d'un votant pour un sondage OPEN. Le
 * revote change simplement l'option choisie (upsert sur la clé téléphone/
 * token) — pas d'historique de bulletins pour ce besoin.
 *
 * Limite assumée : rien n'empêche la même personne de voter une fois avec
 * téléphone et une fois anonymement (repli anonyme volontairement faible).
 */
export async function castVote(
  pollId: string,
  input: unknown,
  meta?: { ipAddress?: string | null; userAgent?: string | null }
) {
  const data = castVoteSchema.parse(input);

  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) throw new Error('Sondage introuvable');
  if (poll.status !== 'OPEN') throw new Error('Le vote n’est pas ouvert');
  const now = new Date();
  if (poll.opensAt && poll.opensAt > now) {
    throw new Error('Le vote n’est pas encore ouvert');
  }
  if (poll.closesAt && poll.closesAt < now) {
    throw new Error('Le vote est clôturé');
  }

  const option = await prisma.pollOption.findUnique({
    where: { id: data.optionId },
  });
  if (!option || option.pollId !== pollId || option.deletedAt) {
    throw new Error('Option invalide pour ce sondage');
  }

  const phoneKey = data.phone ? customerPhoneKey(data.phone) : null;
  if (data.phone && !phoneKey) {
    throw new Error('Numéro de téléphone invalide');
  }

  return prisma.$transaction(async (tx) => {
    const customerId = phoneKey
      ? await upsertCustomerForOrder(tx, phoneKey, null)
      : null;

    if (phoneKey) {
      return tx.pollVote.upsert({
        where: { pollId_voterPhone: { pollId, voterPhone: phoneKey } },
        create: {
          pollId,
          optionId: data.optionId,
          voterPhone: phoneKey,
          customerId,
          ipAddress: meta?.ipAddress ?? null,
          userAgent: meta?.userAgent ?? null,
        },
        update: { optionId: data.optionId },
      });
    }

    return tx.pollVote.upsert({
      where: {
        pollId_voterToken: { pollId, voterToken: data.voterToken ?? '' },
      },
      create: {
        pollId,
        optionId: data.optionId,
        voterToken: data.voterToken,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
      },
      update: { optionId: data.optionId },
    });
  });
}
