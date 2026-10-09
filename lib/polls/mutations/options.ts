import prisma from '@/lib/prisma';
import {
  pollOptionInputSchema,
  pollOptionUpdateSchema,
} from '@/lib/schemas/poll';

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
