// lib/polls.ts
//
// Lecture des sondages (moteur générique de vote). Indépendant de la fidélité
// (lib/loyalty*) — voir décision produit dans lib/poll-mutations.ts.

import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { POLL_LIST_PAGE_SIZE } from '@/config/constants';

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function getPollsAdmin({
  status,
  search,
  page = 1,
}: {
  status?: 'DRAFT' | 'OPEN' | 'CLOSED';
  search?: string;
  page?: number;
} = {}) {
  const pageSize = POLL_LIST_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PollWhereInput = {};
  if (status) where.status = status;
  const term = search?.trim();
  if (term) where.title = { contains: term, mode: 'insensitive' };

  const [polls, total] = await Promise.all([
    prisma.poll.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        _count: {
          select: {
            options: { where: { deletedAt: null } },
            votes: true,
            suggestions: { where: { status: 'PENDING' } },
          },
        },
      },
    }),
    prisma.poll.count({ where }),
  ]);

  return {
    polls: polls.map((p) => ({
      ...p,
      optionsCount: p._count.options,
      votesCount: p._count.votes,
      pendingSuggestionsCount: p._count.suggestions,
    })),
    total,
    pageSize,
  };
}

/** Détail d'un sondage pour l'admin : options même supprimées, tallies. */
export async function getPollAdmin(id: string) {
  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!poll) return null;

  const [tallies, pendingSuggestionsCount] = await Promise.all([
    tallyVotes(id),
    prisma.pollSuggestion.count({
      where: { pollId: id, status: 'PENDING' },
    }),
  ]);

  return {
    poll,
    tallies,
    pendingSuggestionsCount,
  };
}

async function tallyVotes(pollId: string) {
  const grouped = await prisma.pollVote.groupBy({
    by: ['optionId'],
    where: { pollId },
    _count: true,
  });
  const totalVotes = grouped.reduce((sum, g) => sum + g._count, 0);
  const byOption = new Map(grouped.map((g) => [g.optionId, g._count]));
  return { byOption, totalVotes };
}

/** Décompte des votes par option, avec pourcentage. Utilisé par l'admin et
 * par la lecture publique quand `resultsVisibility` l'autorise. */
export async function getPollResults(pollId: string) {
  const options = await prisma.pollOption.findMany({
    where: { pollId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  const { byOption, totalVotes } = await tallyVotes(pollId);

  return {
    totalVotes,
    options: options.map((o) => {
      const votes = byOption.get(o.id) ?? 0;
      return {
        optionId: o.id,
        label: o.label,
        votes,
        percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
      };
    }),
  };
}

export async function listSuggestionsAdmin({
  pollId,
  status,
  page = 1,
}: {
  pollId?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  page?: number;
} = {}) {
  const pageSize = POLL_LIST_PAGE_SIZE;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PollSuggestionWhereInput = {};
  if (pollId) where.pollId = pollId;
  if (status) where.status = status;

  const [suggestions, total] = await Promise.all([
    prisma.pollSuggestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.pollSuggestion.count({ where }),
  ]);

  return { suggestions, total, pageSize };
}

export async function getSuggestion(id: string) {
  return prisma.pollSuggestion.findUnique({ where: { id } });
}

// ─── Public ─────────────────────────────────────────────────────────────────

export async function listPublicPolls({
  status,
}: {
  status: 'OPEN' | 'CLOSED';
}) {
  return prisma.poll.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      status: true,
    },
  });
}

/**
 * Sondage tel que visible côté public. Les décomptes ne sont inclus QUE si
 * `resultsVisibility` l'autorise (LIVE, ou sondage déjà CLOSED) — filtré ici,
 * pas seulement caché côté UI, pour ne jamais faire transiter les chiffres
 * bruts vers le client quand ils ne doivent pas être visibles.
 */
// `cache()` déduplique l'appel entre `generateMetadata` et la page de
// `/sondages/[pollId]` (React request cache) : sans ce wrapper, ça fait
// 2 requêtes Prisma identiques par requête.
export const getPublicPoll = cache(async (id: string) => {
  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, description: true, imageUrl: true },
      },
    },
  });
  if (!poll || poll.status === 'DRAFT') return null;

  const showResults =
    poll.resultsVisibility === 'LIVE' || poll.status === 'CLOSED';
  const results = showResults ? await getPollResults(id) : null;

  return { poll, results };
});

/** Bulletin déjà enregistré pour ce votant (téléphone normalisé et/ou token
 * anonyme), pour pré-sélectionner son choix courant sur la page de vote. */
export async function hasVoted({
  pollId,
  phone,
  voterToken,
}: {
  pollId: string;
  phone?: string | null;
  voterToken?: string | null;
}) {
  const phoneKey = phone ? customerPhoneKey(phone) : null;
  if (phoneKey) {
    const vote = await prisma.pollVote.findUnique({
      where: { pollId_voterPhone: { pollId, voterPhone: phoneKey } },
    });
    if (vote) return vote;
  }
  if (voterToken) {
    return prisma.pollVote.findUnique({
      where: { pollId_voterToken: { pollId, voterToken } },
    });
  }
  return null;
}
