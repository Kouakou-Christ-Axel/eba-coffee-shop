import { Prisma } from '@/generated/prisma/client';
import {
  resolveExpenseItemAmount,
  type ExpenseItemInput,
} from '@/lib/schemas/expense';
import { ensureArticle } from '@/lib/expense-matching';
import { toBaseQty } from '@/lib/expense-units';

export const expenseItemsInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { article: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExpenseInclude;

export async function resolveItemArticle(
  tx: Prisma.TransactionClient,
  item: ExpenseItemInput
) {
  if (item.articleId) {
    const article = await tx.expenseArticle.findUnique({
      where: { id: item.articleId },
    });
    if (!article) throw new Error('Article de dépense introuvable.');
    if (article.archivedAt) {
      return tx.expenseArticle.update({
        where: { id: article.id },
        data: { archivedAt: null },
      });
    }
    return article;
  }
  return ensureArticle(tx, item.articleName ?? item.rawLabel);
}

export async function createExpenseItems(
  tx: Prisma.TransactionClient,
  expenseId: string,
  items: ExpenseItemInput[]
) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const amount = resolveExpenseItemAmount(item);
    if (amount == null) {
      throw new Error(
        `Ligne « ${item.rawLabel} » : montant manquant (indiquer un montant, ou un prix unitaire avec une quantité).`
      );
    }
    const article = await resolveItemArticle(tx, item);
    const qtyBase = toBaseQty({
      formatQty: item.formatQty ?? null,
      formatSize: item.formatSize ?? null,
      unit: item.unit ?? null,
      baseUnit: article.baseUnit ?? item.unit ?? null,
    });
    await tx.expenseItem.create({
      data: {
        expenseId,
        articleId: article.id,
        rawLabel: item.rawLabel,
        label: item.label ?? null,
        qtyBase: qtyBase ?? null,
        formatQty: item.formatQty ?? null,
        formatSize: item.formatSize ?? null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice ?? null,
        amount,
        pendingQuantity: item.pendingQuantity ?? false,
        sortOrder: i,
      },
    });
  }
}

export function sumExpenseItems(items: ExpenseItemInput[]): number {
  return items.reduce((sum, item) => {
    const amount = resolveExpenseItemAmount(item);
    if (amount == null) {
      throw new Error(
        `Ligne « ${item.rawLabel} » : montant manquant (indiquer un montant, ou un prix unitaire avec une quantité).`
      );
    }
    return sum + amount;
  }, 0);
}
