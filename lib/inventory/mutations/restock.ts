import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { createExpense, deleteExpense } from '@/lib/expense-mutations';
import { batchRestockSchema } from '@/lib/schemas/inventory';
import { num, recomputePmp, recomputeItemFromHistory } from './helpers';

export async function batchRestock(
  input: unknown,
  createdById?: string,
  source: 'MANUAL' | 'IMPORT' = 'MANUAL'
) {
  const data = batchRestockSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  const lines = data.lines.map((l) => ({
    ...l,
    totalCost: Math.round(l.quantity * l.unitCost),
  }));
  const amount = lines.reduce((s, l) => s + l.totalCost, 0);

  // Dépense liée créée AVANT (sa propre transaction gère la numérotation de reçu).
  let expenseId: string | null = null;
  if (data.createExpense) {
    if (amount <= 0) {
      throw new Error(
        'Montant total nul : impossible de créer une dépense liée.'
      );
    }
    const expense = await createExpense(
      {
        date: data.date,
        amount,
        categoryId: data.expenseCategoryId!,
        paymentMethod: data.paymentMethod,
        supplier: data.supplier ?? null,
        note: data.note ?? `Réappro stock (${lines.length} article(s))`,
      },
      createdById
    );
    expenseId = expense.id;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryRestockBatch.create({
        data: {
          date,
          supplier: data.supplier ?? null,
          note: data.note ?? null,
          source,
          expenseId,
          createdById: createdById ?? null,
        },
      });
      for (const l of lines) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: l.itemId },
          select: { currentQuantity: true, avgUnitCost: true },
        });
        if (!item) throw new Error(`Article introuvable : ${l.itemId}`);
        const qty = num(item.currentQuantity);
        const newAvg = recomputePmp(
          qty,
          item.avgUnitCost,
          l.quantity,
          l.unitCost
        );
        await tx.inventoryPurchase.create({
          data: {
            itemId: l.itemId,
            date,
            quantity: l.quantity,
            unitCost: l.unitCost,
            totalCost: l.totalCost,
            supplier: data.supplier ?? null,
            note: data.note ?? null,
            batchId: batch.id,
            expenseId,
            createdById: createdById ?? null,
          },
        });
        await tx.inventoryItem.update({
          where: { id: l.itemId },
          data: { currentQuantity: qty + l.quantity, avgUnitCost: newAvg },
        });
      }
      return {
        batchId: batch.id,
        expenseId,
        total: amount,
        lineCount: lines.length,
      };
    });
  } catch (err) {
    // Compensation : la dépense a été créée hors transaction, on la retire.
    if (expenseId) {
      try {
        await deleteExpense(expenseId);
      } catch {
        /* best effort */
      }
    }
    throw err;
  }
}

/** Annule un lot de réappro entier en une fois (restaure stock + PMP, supprime la dépense liée). */
export async function cancelRestockBatch(batchId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.inventoryRestockBatch.findUnique({
      where: { id: batchId },
      include: { purchases: { select: { itemId: true } } },
    });
    if (!batch) throw new Error('Lot de réappro introuvable.');
    if (batch.canceledAt) throw new Error('Ce lot est déjà annulé.');

    // Garde-fou : un comptage POSTÉRIEUR a déjà figé la période → on refuse.
    const laterCount = await tx.inventoryCount.findFirst({
      where: { date: { gt: batch.date } },
      select: { id: true },
    });
    if (laterCount) {
      throw new Error(
        'Annulation impossible : un inventaire postérieur a déjà été enregistré.'
      );
    }

    const itemIds = [...new Set(batch.purchases.map((p) => p.itemId))];
    await tx.inventoryPurchase.deleteMany({ where: { batchId } });
    await tx.inventoryRestockBatch.update({
      where: { id: batchId },
      data: { canceledAt: new Date() },
    });
    for (const itemId of itemIds) {
      await recomputeItemFromHistory(tx, itemId);
    }
    if (batch.expenseId) {
      await tx.expense.delete({ where: { id: batch.expenseId } });
    }
    return { batchId, itemsRestored: itemIds.length };
  });
}
