import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import {
  pollSuggestionSubmitSchema,
  pollSuggestionModerationSchema,
} from '@/lib/schemas/poll';

/** Soumission publique (aucune session). */
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
