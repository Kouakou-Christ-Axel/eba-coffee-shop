import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  ensureArticle,
  resolveArticle,
  learnAlias,
  normalizeSupplierKey,
} from '@/lib/expense-matching';

export const INVENTORY_UNIT_TO_BASE: Record<string, string> = {
  UNIT: 'unite',
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'mL',
  BOX: 'unite',
};

export type PurchaseWithItem = {
  itemId: string;
  quantity: Prisma.Decimal;
  unitCost: number;
  totalCost: number;
  item: { id: string; name: string; unit: string };
};

export async function createExpenseItemsFromPurchases(
  client: PrismaClient,
  expenseId: string,
  purchases: PurchaseWithItem[]
): Promise<number> {
  await client.$transaction(async (tx) => {
    for (let i = 0; i < purchases.length; i++) {
      const p = purchases[i];
      const article = await ensureArticle(tx, p.item.name);
      if (!article.inventoryItemId) {
        await tx.expenseArticle.update({
          where: { id: article.id },
          data: { inventoryItemId: p.itemId, trackInventory: true },
        });
      }
      await tx.expenseItem.create({
        data: {
          expenseId,
          articleId: article.id,
          rawLabel: p.item.name,
          qtyBase: p.quantity,
          formatQty: p.quantity,
          unit: INVENTORY_UNIT_TO_BASE[p.item.unit] ?? 'unite',
          unitPrice: p.unitCost,
          amount: p.totalCost,
          sortOrder: i,
        },
      });
    }
  });
  return purchases.length;
}

export const purchasesWithItemInclude = {
  inventoryPurchases: {
    orderBy: { createdAt: 'asc' },
    include: { item: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.ExpenseInclude;

export async function detailExpenseFromPurchases(
  expenseId: string,
  client: PrismaClient = prisma
): Promise<number> {
  const expense = await client.expense.findUnique({
    where: { id: expenseId },
    include: {
      ...purchasesWithItemInclude,
      _count: { select: { items: true } },
    },
  });
  if (!expense || expense._count.items > 0) return 0;
  const purchasesSum = expense.inventoryPurchases.reduce(
    (s, p) => s + p.totalCost,
    0
  );
  if (purchasesSum !== expense.amount) return 0;
  return createExpenseItemsFromPurchases(
    client,
    expense.id,
    expense.inventoryPurchases
  );
}

export async function backfillExpenseItems(
  client: PrismaClient = prisma,
  opts: { dry?: boolean } = {}
): Promise<{
  processed: number;
  itemsCreated: number;
  skippedMismatch: {
    expenseId: string;
    receiptNo: string | null;
    amount: number;
    purchasesSum: number;
  }[];
}> {
  const expenses = await client.expense.findMany({
    where: { inventoryPurchases: { some: {} }, items: { none: {} } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: purchasesWithItemInclude,
  });

  let processed = 0;
  let itemsCreated = 0;
  const skippedMismatch: {
    expenseId: string;
    receiptNo: string | null;
    amount: number;
    purchasesSum: number;
  }[] = [];

  for (const expense of expenses) {
    const purchasesSum = expense.inventoryPurchases.reduce(
      (s, p) => s + p.totalCost,
      0
    );
    if (purchasesSum !== expense.amount) {
      skippedMismatch.push({
        expenseId: expense.id,
        receiptNo: expense.receiptNo,
        amount: expense.amount,
        purchasesSum,
      });
      continue;
    }
    if (!opts.dry) {
      await createExpenseItemsFromPurchases(
        client,
        expense.id,
        expense.inventoryPurchases
      );
    }
    processed++;
    itemsCreated += expense.inventoryPurchases.length;
  }

  return { processed, itemsCreated, skippedMismatch };
}

export async function rematchUnlinkedItems(
  client: PrismaClient = prisma,
  opts: { dry?: boolean; supplierKey?: string } = {}
): Promise<{ linked: number; ambiguous: number; none: number }> {
  const items = await client.expenseItem.findMany({
    where: { articleId: null },
    include: { expense: { select: { supplier: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let linked = 0;
  let ambiguous = 0;
  let none = 0;

  for (const item of items) {
    const supplierKey =
      opts.supplierKey ?? normalizeSupplierKey(item.expense.supplier);
    const resolution = await resolveArticle(
      { rawLabel: item.rawLabel, supplierKey },
      client
    );
    if ('matched' in resolution) {
      if (!opts.dry) {
        await client.$transaction(async (tx) => {
          await tx.expenseItem.update({
            where: { id: item.id },
            data: { articleId: resolution.matched.id },
          });
          await learnAlias(tx, {
            alias: item.rawLabel,
            supplierKey,
            articleId: resolution.matched.id,
          });
        });
      }
      linked++;
    } else if ('candidates' in resolution && resolution.candidates.length > 0) {
      ambiguous++;
    } else {
      none++;
    }
  }

  return { linked, ambiguous, none };
}
