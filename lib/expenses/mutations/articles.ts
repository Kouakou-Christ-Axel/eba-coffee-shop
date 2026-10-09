import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  expenseArticleRenameSchema,
  expenseArticleSettingsSchema,
} from '@/lib/schemas/expense';
import {
  learnAlias,
  normalizeLabel,
  normalizeSupplierKey,
} from '@/lib/expense-matching';

/** Renomme un article (le nom normalisé suit ; unicité contrôlée). */
export async function renameExpenseArticle(id: string, input: unknown) {
  const { name } = expenseArticleRenameSchema.parse(input);
  try {
    return await prisma.expenseArticle.update({
      where: { id },
      data: { name, normalizedName: normalizeLabel(name) },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new Error('Un article porte déjà ce nom.');
    }
    throw err;
  }
}

// Soft delete : l'article disparaît des sélecteurs/de l'auto-complétion, mais
// les lignes existantes (et donc l'historique/stats) le conservent.
export async function archiveExpenseArticle(id: string) {
  return prisma.expenseArticle.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}

/** Réglages d'un article (unité de base, suivi de stock, emplacement…). */
export async function setExpenseArticleSettings(id: string, input: unknown) {
  const data = expenseArticleSettingsSchema.parse(input);
  try {
    return await prisma.expenseArticle.update({
      where: { id },
      data: {
        ...(data.baseUnit !== undefined ? { baseUnit: data.baseUnit } : {}),
        ...(data.trackInventory !== undefined
          ? { trackInventory: data.trackInventory }
          : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.wholesaleRefPrice !== undefined
          ? { wholesaleRefPrice: data.wholesaleRefPrice }
          : {}),
        ...(data.inventoryItemId !== undefined
          ? { inventoryItemId: data.inventoryItemId }
          : {}),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' &&
      (err.meta?.target as string[] | undefined)?.includes('inventoryItemId')
    ) {
      throw new Error(
        'Cette référence de stock est déjà liée à un autre article.'
      );
    }
    throw err;
  }
}

export async function mergeArticles(
  sourceId: string,
  targetId: string
): Promise<{ relinkedItems: number }> {
  if (sourceId === targetId) {
    throw new Error('Impossible de fusionner un article avec lui-même.');
  }
  return prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.expenseArticle.findUnique({ where: { id: sourceId } }),
      tx.expenseArticle.findUnique({ where: { id: targetId } }),
    ]);
    if (!source) throw new Error('Article source introuvable.');
    if (!target) throw new Error('Article cible introuvable.');

    const itemsResult = await tx.expenseItem.updateMany({
      where: { articleId: sourceId },
      data: { articleId: targetId },
    });

    const sourceAliases = await tx.articleAlias.findMany({
      where: { articleId: sourceId },
    });
    for (const alias of sourceAliases) {
      const conflict = await tx.articleAlias.findFirst({
        where: {
          alias: alias.alias,
          supplierKey: alias.supplierKey,
          articleId: targetId,
        },
      });
      if (conflict) {
        await tx.articleAlias.delete({ where: { id: alias.id } });
      } else {
        await tx.articleAlias.update({
          where: { id: alias.id },
          data: { articleId: targetId },
        });
      }
    }

    await tx.expenseArticle.update({
      where: { id: sourceId },
      data: { archivedAt: new Date(), mergedIntoId: targetId },
    });

    return { relinkedItems: itemsResult.count };
  });
}

export async function relinkExpenseItem(
  itemId: string,
  newArticleId: string
): Promise<{ previousArticleId: string | null; newArticleId: string }> {
  return prisma.$transaction(async (tx) => {
    const item = await tx.expenseItem.findUnique({
      where: { id: itemId },
      include: { expense: { select: { supplier: true } } },
    });
    if (!item) throw new Error('Ligne de dépense introuvable.');
    const target = await tx.expenseArticle.findUnique({
      where: { id: newArticleId },
    });
    if (!target) throw new Error('Article de dépense introuvable.');

    const previousArticleId = item.articleId;
    await tx.expenseItem.update({
      where: { id: itemId },
      data: { articleId: newArticleId },
    });
    await learnAlias(tx, {
      alias: item.rawLabel,
      supplierKey: normalizeSupplierKey(item.expense.supplier),
      articleId: newArticleId,
    });
    return { previousArticleId, newArticleId };
  });
}
