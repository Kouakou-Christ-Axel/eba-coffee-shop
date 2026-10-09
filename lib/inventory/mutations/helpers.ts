import { Prisma, type Prisma as PrismaNS } from '@/generated/prisma/client';

export type Tx = PrismaNS.TransactionClient;

/** Decimal Prisma → number. */
export function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

/** Prix moyen pondéré (CUMP mobile) après un achat. */
export function recomputePmp(
  currentQty: number,
  currentAvg: number,
  addQty: number,
  addUnitCost: number
): number {
  const totalQty = currentQty + addQty;
  if (totalQty <= 0) return addUnitCost;
  return Math.round(
    (currentQty * currentAvg + addQty * addUnitCost) / totalQty
  );
}

export async function recomputeItemFromHistory(
  tx: Tx,
  itemId: string
): Promise<void> {
  const lastLine = await tx.inventoryCountLine.findFirst({
    where: { itemId },
    orderBy: [{ count: { date: 'desc' } }, { count: { createdAt: 'desc' } }],
    include: { count: { select: { date: true } } },
  });
  let qty = lastLine ? num(lastLine.countedQuantity) : 0;
  let avg = lastLine ? lastLine.unitCostSnapshot : 0;
  const sinceDate = lastLine?.count.date ?? null;

  const purchases = await tx.inventoryPurchase.findMany({
    where: {
      itemId,
      ...(sinceDate ? { date: { gt: sinceDate } } : {}),
      OR: [{ batchId: null }, { batch: { is: { canceledAt: null } } }],
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: { quantity: true, unitCost: true },
  });
  for (const p of purchases) {
    const pQty = num(p.quantity);
    avg = recomputePmp(qty, avg, pQty, p.unitCost);
    qty += pQty;
  }
  await tx.inventoryItem.update({
    where: { id: itemId },
    data: { currentQuantity: qty, avgUnitCost: avg },
  });
}

export async function createOpeningCount(
  tx: Tx,
  date: Date,
  lines: { itemId: string; qty: number; unitCost: number }[],
  createdById?: string,
  label = 'Stock initial'
): Promise<void> {
  const count = await tx.inventoryCount.create({
    data: { date, label, createdById: createdById ?? null },
  });
  for (const l of lines) {
    await tx.inventoryCountLine.create({
      data: {
        countId: count.id,
        itemId: l.itemId,
        openingQuantity: 0,
        purchasesQuantity: 0,
        countedQuantity: l.qty,
        consumption: 0,
        unitCostSnapshot: l.unitCost,
      },
    });
    await tx.inventoryItem.update({
      where: { id: l.itemId },
      data: {
        currentQuantity: l.qty,
        avgUnitCost: l.unitCost,
        lastCountedAt: date,
      },
    });
  }
}
