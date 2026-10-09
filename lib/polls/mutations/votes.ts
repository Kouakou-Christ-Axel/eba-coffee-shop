import prisma from '@/lib/prisma';
import { customerPhoneKey } from '@/lib/phone';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import { castVoteSchema } from '@/lib/schemas/poll';

/** Enregistre (ou modifie) le bulletin d'un votant pour un sondage OPEN. */
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
  const voterToken = data.voterToken ?? null;

  return prisma.$transaction(async (tx) => {
    const customerId = phoneKey
      ? await upsertCustomerForOrder(tx, phoneKey, null)
      : null;

    const [existingByToken, existingByPhone] = await Promise.all([
      voterToken
        ? tx.pollVote.findUnique({
            where: { pollId_voterToken: { pollId, voterToken } },
          })
        : Promise.resolve(null),
      phoneKey
        ? tx.pollVote.findUnique({
            where: { pollId_voterPhone: { pollId, voterPhone: phoneKey } },
          })
        : Promise.resolve(null),
    ]);

    if (
      existingByToken &&
      existingByPhone &&
      existingByToken.id !== existingByPhone.id
    ) {
      await tx.pollVote.delete({ where: { id: existingByToken.id } });
      return tx.pollVote.update({
        where: { id: existingByPhone.id },
        data: {
          optionId: data.optionId,
          voterToken: voterToken ?? existingByPhone.voterToken,
          customerId,
        },
      });
    }

    const existing = existingByPhone ?? existingByToken;
    if (existing) {
      return tx.pollVote.update({
        where: { id: existing.id },
        data: {
          optionId: data.optionId,
          ...(phoneKey && { voterPhone: phoneKey, customerId }),
          ...(voterToken && { voterToken }),
        },
      });
    }

    return tx.pollVote.create({
      data: {
        pollId,
        optionId: data.optionId,
        voterPhone: phoneKey,
        voterToken,
        customerId,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    });
  });
}
