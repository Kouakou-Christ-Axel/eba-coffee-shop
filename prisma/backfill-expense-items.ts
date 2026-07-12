// prisma/backfill-expense-items.ts
//
// Backfill rétroactif du détail par article (`ExpenseItem`) des dépenses déjà
// liées à des achats d'inventaire (créées par un réappro de stock) — donne
// instantanément l'historique de fréquence (« combien de fois a-t-on acheté la
// farine T45 ») pour tout ce qui passait par le stock.
//
//   pnpm db:backfill-expense-items          # applique
//   pnpm db:backfill-expense-items --dry    # simulation (aucune écriture)
//
// Idempotent (filtre `items: { none: {} }`). Ne modifie JAMAIS le montant
// d'une dépense : en cas d'écart (montant édité après coup, somme des achats
// ≠ montant), la dépense est ignorée et rapportée pour un complément manuel.
//
// Volontairement AUTONOME (n'importe rien de lib/expense-mutations.ts, qui
// n'existe pas encore à ce stade du refactor) : la logique de rapprochement
// article (normalisation du nom, résolution/insertion) est inlinée ici en
// version minimale. Le module lib/expense-mutations.ts (étape suivante)
// pourra réutiliser une variante plus riche sans que ce script en dépende.

import { fileURLToPath } from 'node:url';
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Normalise un libellé d'article pour la clé unique `normalizedName`. */
function normalizeArticleName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Libellé d'unité affiché pour chaque valeur de l'enum InventoryUnit. */
const INVENTORY_UNIT_LABEL: Record<string, string> = {
  UNIT: 'unité',
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'mL',
  BOX: 'carton',
};

type PurchaseWithItem = {
  itemId: string;
  quantity: Prisma.Decimal;
  unitCost: number;
  totalCost: number;
  item: { name: string; unit: string };
};

/**
 * Retrouve (ou crée) l'article de dépense correspondant à un item
 * d'inventaire : d'abord par `inventoryItemId` lié, sinon par nom normalisé
 * (ressuscite un article soft-deleted), sinon création.
 */
async function ensureExpenseArticle(
  tx: Prisma.TransactionClient,
  name: string,
  inventoryItemId: string
) {
  const linked = await tx.expenseArticle.findUnique({
    where: { inventoryItemId },
  });
  if (linked) {
    return linked.archivedAt
      ? tx.expenseArticle.update({
          where: { id: linked.id },
          data: { archivedAt: null },
        })
      : linked;
  }

  const normalizedName = normalizeArticleName(name);
  const existing = await tx.expenseArticle.findUnique({
    where: { normalizedName },
  });
  if (existing) {
    const stampInventory = !existing.inventoryItemId;
    if (existing.archivedAt || stampInventory) {
      return tx.expenseArticle.update({
        where: { id: existing.id },
        data: {
          archivedAt: null,
          ...(stampInventory ? { inventoryItemId } : {}),
        },
      });
    }
    return existing;
  }

  return tx.expenseArticle.create({
    data: { name, normalizedName, inventoryItemId },
  });
}

async function createExpenseItemsFromPurchases(
  client: PrismaClient,
  expenseId: string,
  purchases: PurchaseWithItem[]
): Promise<number> {
  await client.$transaction(async (tx) => {
    for (let i = 0; i < purchases.length; i++) {
      const p = purchases[i];
      const article = await ensureExpenseArticle(tx, p.item.name, p.itemId);
      await tx.expenseItem.create({
        data: {
          expenseId,
          articleId: article.id,
          rawLabel: p.item.name,
          qtyBase: p.quantity,
          unit: INVENTORY_UNIT_LABEL[p.item.unit] ?? null,
          unitPrice: p.unitCost,
          amount: p.totalCost,
          sortOrder: i,
        },
      });
    }
  });
  return purchases.length;
}

const purchasesWithItemInclude = {
  inventoryPurchases: {
    orderBy: { createdAt: 'asc' as const },
    include: { item: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.ExpenseInclude;

async function backfillExpenseItems(
  client: PrismaClient,
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

async function main() {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const { processed, itemsCreated, skippedMismatch } =
      await backfillExpenseItems(prisma, { dry });
    const prefix = dry ? '[simulation] ' : '';
    console.log(
      `${prefix}Backfill du détail des dépenses terminé : ${processed} ` +
        `dépense(s) détaillée(s), ${itemsCreated} ligne(s) créée(s).`
    );
    if (skippedMismatch.length > 0) {
      console.log(
        `${skippedMismatch.length} dépense(s) ignorée(s) (somme des achats ≠ montant) :`
      );
      for (const s of skippedMismatch) {
        console.log(
          `  - ${s.receiptNo ?? s.expenseId} : montant ${s.amount} F, ` +
            `achats ${s.purchasesSum} F`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  // @ts-expect-error -- propriété Bun-spécifique non typée
  import.meta.main === true ||
  (typeof process !== 'undefined' &&
    process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
