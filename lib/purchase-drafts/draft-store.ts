import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC, todayDateString } from '@/lib/timezone';
import type { DraftKind } from './types';

export async function claimDraft(draftId: string, kind: DraftKind) {
  const now = new Date();
  const claim = await prisma.purchaseDraft.updateMany({
    where: { id: draftId, kind, confirmedAt: null, expiresAt: { gt: now } },
    data: { confirmedAt: now },
  });

  if (claim.count === 0) {
    const existing = await prisma.purchaseDraft.findUnique({
      where: { id: draftId },
    });
    if (!existing || existing.kind !== kind) {
      throw new Error('Brouillon introuvable.');
    }
    if (existing.confirmedAt) {
      throw new Error('Ce brouillon a déjà été confirmé.');
    }
    if (existing.expiresAt <= now) {
      throw new Error(
        'Ce brouillon a expiré ; merci de relancer la préparation.'
      );
    }
    // Ne devrait pas arriver (les trois cas ci-dessus couvrent tous les échecs
    // possibles de la clause `where`), mais on garde un filet de sécurité.
    throw new Error('Impossible de confirmer ce brouillon.');
  }

  return prisma.purchaseDraft.findUniqueOrThrow({ where: { id: draftId } });
}

export async function countUnmatchedRawLabelThisMonth(
  rawLabel: string
): Promise<number> {
  const monthStart = parseDateOnlyToUTC(`${todayDateString().slice(0, 7)}-01`)!;
  return prisma.expenseItem.count({
    where: {
      articleId: null,
      rawLabel: { equals: rawLabel, mode: 'insensitive' },
      expense: { date: { gte: monthStart } },
    },
  });
}

/** Supprime les brouillons expirés jamais confirmés. */
export async function purgeExpiredDrafts(): Promise<{ deleted: number }> {
  const result = await prisma.purchaseDraft.deleteMany({
    where: { expiresAt: { lt: new Date() }, confirmedAt: null },
  });
  return { deleted: result.count };
}
