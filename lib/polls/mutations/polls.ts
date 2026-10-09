import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  pollInputSchema,
  pollUpdateSchema,
  pollStatusUpdateSchema,
} from '@/lib/schemas/poll';
import { toDateOrNull } from './helpers';

export async function createPoll(input: unknown, createdById?: string) {
  const data = pollInputSchema.parse(input);
  return prisma.poll.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
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
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
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
