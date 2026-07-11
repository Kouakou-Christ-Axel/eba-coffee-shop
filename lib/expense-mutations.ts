// lib/expense-mutations.ts
//
// Écritures pour le suivi des dépenses (catégories + dépenses). Valide via les
// schémas Zod centralisés (lib/schemas/expense.ts), parse les dates civiles en
// @db.Date, et traduit les erreurs Prisma en messages lisibles.

import { Prisma } from '@/generated/prisma/client';
import type { PrismaClient } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  getNextReceiptSeq,
  receiptPeriodFromDate,
  formatReceiptNo,
  RECEIPT_NUMBER_MAX_RETRIES,
} from '@/lib/expense-numbering';
import {
  expenseCategoryInputSchema,
  expenseCategoryUpdateSchema,
  expenseInputSchema,
  expenseUpdateSchema,
  expenseArticleRenameSchema,
  resolveExpenseItemAmount,
  type ExpenseItemInput,
} from '@/lib/schemas/expense';
import { INVENTORY_UNIT_LABEL } from '@/lib/schemas/inventory';

// ─── Catégories ───────────────────────────────────────────────────────────────

export async function createExpenseCategory(input: unknown) {
  const { name, nature } = expenseCategoryInputSchema.parse(input);
  // Le nom reste unique globalement. Si une catégorie du même nom a été soft
  // delete, on la « ressuscite » (deletedAt → null) au lieu d'échouer.
  const existing = await prisma.expenseCategory.findUnique({ where: { name } });
  const max = await prisma.expenseCategory.aggregate({
    _max: { sortOrder: true },
  });
  if (existing) {
    if (existing.deletedAt === null) {
      throw new Error('Une catégorie porte déjà ce nom.');
    }
    return prisma.expenseCategory.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        ...(nature !== undefined ? { nature } : {}),
      },
    });
  }
  try {
    return await prisma.expenseCategory.create({
      data: {
        name,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        ...(nature !== undefined ? { nature } : {}),
      },
    });
  } catch (err) {
    throw rethrowUniqueName(err);
  }
}

export async function updateExpenseCategory(id: string, input: unknown) {
  const data = expenseCategoryUpdateSchema.parse(input);
  try {
    return await prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.nature !== undefined ? { nature: data.nature } : {}),
      },
    });
  } catch (err) {
    throw rethrowUniqueName(err);
  }
}

// Soft delete : on retire la catégorie des sélecteurs/listes sans toucher aux
// dépenses rattachées (qui conservent leur libellé via la relation).
export async function deleteExpenseCategory(id: string) {
  return prisma.expenseCategory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ─── Articles (référentiel) ───────────────────────────────────────────────────

/** Clé de déduplication du référentiel : minuscules, trim, espaces réduits. */
export function normalizeArticleName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

const expenseItemsInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { article: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExpenseInclude;

/**
 * Retrouve (ou crée) l'article visé par une ligne : par `articleId` explicite,
 * sinon par item d'inventaire lié, sinon par nom normalisé (« farine t45 » =
 * « Farine T45 » — l'article soft-deleted est ressuscité). Créé à la volée en
 * dernier recours : la saisie en texte libre ne demande aucune étape préalable.
 */
async function ensureExpenseArticle(
  tx: Prisma.TransactionClient,
  spec: { articleId?: string; name?: string; inventoryItemId?: string | null }
) {
  if (spec.articleId) {
    const article = await tx.expenseArticle.findUnique({
      where: { id: spec.articleId },
    });
    if (!article) throw new Error('Article de dépense introuvable.');
    if (article.deletedAt) {
      return tx.expenseArticle.update({
        where: { id: article.id },
        data: { deletedAt: null },
      });
    }
    return article;
  }

  if (spec.inventoryItemId) {
    const linked = await tx.expenseArticle.findUnique({
      where: { inventoryItemId: spec.inventoryItemId },
    });
    if (linked) {
      return linked.deletedAt
        ? tx.expenseArticle.update({
            where: { id: linked.id },
            data: { deletedAt: null },
          })
        : linked;
    }
  }

  const name = spec.name!;
  const nameNormalized = normalizeArticleName(name);
  const existing = await tx.expenseArticle.findUnique({
    where: { nameNormalized },
  });
  if (existing) {
    const stampInventory = spec.inventoryItemId && !existing.inventoryItemId;
    if (existing.deletedAt || stampInventory) {
      return tx.expenseArticle.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          ...(stampInventory ? { inventoryItemId: spec.inventoryItemId } : {}),
        },
      });
    }
    return existing;
  }
  return tx.expenseArticle.create({
    data: {
      name,
      nameNormalized,
      inventoryItemId: spec.inventoryItemId ?? null,
    },
  });
}

/** Renomme un article (la clé normalisée suit ; unicité contrôlée). */
export async function renameExpenseArticle(id: string, input: unknown) {
  const { name } = expenseArticleRenameSchema.parse(input);
  try {
    return await prisma.expenseArticle.update({
      where: { id },
      data: { name, nameNormalized: normalizeArticleName(name) },
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

// Soft delete : l'article disparaît de l'autocomplétion mais les lignes
// existantes (et donc l'historique/stats) le conservent.
export async function deleteExpenseArticle(id: string) {
  return prisma.expenseArticle.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// ─── Dépenses ─────────────────────────────────────────────────────────────────

/** Somme des montants effectifs (fournis ou dérivés de qté × PU) des lignes. */
function sumExpenseItems(items: ExpenseItemInput[]): number {
  return items.reduce((s, i) => s + resolveExpenseItemAmount(i), 0);
}

async function createExpenseItems(
  tx: Prisma.TransactionClient,
  expenseId: string,
  items: ExpenseItemInput[]
) {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const article = await ensureExpenseArticle(tx, {
      articleId: item.articleId,
      name: item.articleName,
      inventoryItemId: item.inventoryItemId ?? null,
    });
    await tx.expenseItem.create({
      data: {
        expenseId,
        articleId: article.id,
        label: item.label ?? null,
        quantity: item.quantity ?? null,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice ?? null,
        amount: resolveExpenseItemAmount(item),
        sortOrder: i,
      },
    });
  }
}

export async function createExpense(input: unknown, createdById?: string) {
  const data = expenseInputSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  // Montant : fourni, ou dérivé de la somme des lignes (le schéma garantit
  // l'égalité quand les deux sont présents).
  const amount = data.amount ?? sumExpenseItems(data.items!);
  // Numéro de reçu : compteur du mois civil de la dépense. Figé à la création.
  const receiptPeriod = receiptPeriodFromDate(date);

  // Retry sur conflit de l'index unique (receiptPeriod, receiptSeq) en cas de
  // saisies concurrentes sur le même mois.
  for (let attempt = 0; attempt < RECEIPT_NUMBER_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const receiptSeq = await getNextReceiptSeq(tx, receiptPeriod);
        const expense = await tx.expense.create({
          data: {
            date,
            amount,
            categoryId: data.categoryId,
            paymentMethod: data.paymentMethod ?? 'CASH',
            supplier: data.supplier ?? null,
            note: data.note ?? null,
            receiptUrl: data.receiptUrl ?? null,
            createdById: createdById ?? null,
            receiptPeriod,
            receiptSeq,
            receiptNo: formatReceiptNo(receiptPeriod, receiptSeq),
          },
        });
        if (data.items) {
          await createExpenseItems(tx, expense.id, data.items);
          return tx.expense.findUniqueOrThrow({
            where: { id: expense.id },
            include: expenseItemsInclude,
          });
        }
        return expense;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < RECEIPT_NUMBER_MAX_RETRIES - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Impossible de générer un numéro de reçu de dépense');
}

// Note : le numéro de reçu (receiptNo/receiptPeriod/receiptSeq) est IMMUABLE et
// n'est donc jamais modifié ici — même si la `date` est éditée vers un autre mois.
// Détail : `items` = remplacement complet des lignes ; `items: null` = retrait
// du détail ; invariant sum(items) == amount préservé dans tous les cas.
export async function updateExpense(id: string, input: unknown) {
  const data = expenseUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const itemsProvided = data.items !== undefined;
    if (!itemsProvided && data.amount !== undefined) {
      // Garde-fou : changer le montant d'une dépense détaillée sans toucher
      // aux lignes casserait l'invariant somme == montant.
      const existingItems = await tx.expenseItem.count({
        where: { expenseId: id },
      });
      if (existingItems > 0) {
        throw new Error(
          'Cette dépense est détaillée : modifiez ses lignes (items), ou retirez le détail (items: null) pour changer le montant seul.'
        );
      }
    }

    // Montant : explicite, sinon dérivé des nouvelles lignes.
    const amount =
      data.amount ?? (data.items ? sumExpenseItems(data.items) : undefined);

    if (itemsProvided) {
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });
    }
    const expense = await tx.expense.update({
      where: { id },
      data: {
        ...(data.date !== undefined
          ? { date: parseDateOnlyToUTC(data.date)! }
          : {}),
        ...(amount !== undefined ? { amount } : {}),
        ...(data.categoryId !== undefined
          ? { categoryId: data.categoryId }
          : {}),
        ...(data.paymentMethod !== undefined
          ? { paymentMethod: data.paymentMethod }
          : {}),
        ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.receiptUrl !== undefined
          ? { receiptUrl: data.receiptUrl }
          : {}),
      },
    });
    if (data.items) {
      await createExpenseItems(tx, id, data.items);
      return tx.expense.findUniqueOrThrow({
        where: { id },
        include: expenseItemsInclude,
      });
    }
    return expense;
  });
}

// Les lignes de détail suivent la dépense (cascade DB) ; le référentiel
// d'articles, lui, est préservé.
export async function deleteExpense(id: string) {
  return prisma.expense.delete({ where: { id } });
}

/**
 * Numérote rétroactivement les dépenses sans numéro de reçu (utile après l'ajout
 * de la fonctionnalité sur une base déjà remplie). Idempotent : ne touche que
 * les lignes `receiptNo IS NULL` et continue la séquence du mois après le plus
 * grand numéro déjà attribué. Ordre chronologique (date ASC, createdAt ASC,
 * id ASC), cohérent avec la migration.
 *
 * Partagé par la server action du dashboard et le script CLI
 * (`prisma/backfill-expense-receipts.ts`), d'où le `client` injectable.
 */
export async function backfillExpenseReceipts(
  client: PrismaClient = prisma
): Promise<{ updated: number; total: number }> {
  const expenses = await client.expense.findMany({
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      date: true,
      receiptNo: true,
      receiptPeriod: true,
      receiptSeq: true,
    },
  });

  // Plus grande séquence déjà attribuée par mois (pour continuer sans collision).
  const maxSeqByPeriod = new Map<string, number>();
  for (const e of expenses) {
    if (e.receiptPeriod && e.receiptSeq != null) {
      maxSeqByPeriod.set(
        e.receiptPeriod,
        Math.max(maxSeqByPeriod.get(e.receiptPeriod) ?? 0, e.receiptSeq)
      );
    }
  }

  let updated = 0;
  for (const e of expenses) {
    if (e.receiptNo) continue; // déjà numérotée
    const period = receiptPeriodFromDate(e.date);
    const seq = (maxSeqByPeriod.get(period) ?? 0) + 1;
    maxSeqByPeriod.set(period, seq);
    await client.expense.update({
      where: { id: e.id },
      data: {
        receiptPeriod: period,
        receiptSeq: seq,
        receiptNo: formatReceiptNo(period, seq),
      },
    });
    updated++;
  }

  return { updated, total: expenses.length };
}

type PurchaseWithItem = {
  itemId: string;
  quantity: Prisma.Decimal;
  unitCost: number;
  totalCost: number;
  item: { name: string; unit: keyof typeof INVENTORY_UNIT_LABEL };
};

/**
 * Génère les lignes de détail (`ExpenseItem`) d'une dépense depuis ses achats
 * d'inventaire — chemin INTERNE, volontairement hors du schéma de saisie
 * (`expenseItemInputSchema`) : pas de plafond de lignes (un import peut en
 * compter jusqu'à 1000) et montants à 0 autorisés (ligne de réappro gratuite),
 * l'invariant somme(items) == amount tenant par construction. Le montant de la
 * dépense n'est JAMAIS modifié.
 */
async function createExpenseItemsFromPurchases(
  client: PrismaClient,
  expenseId: string,
  purchases: PurchaseWithItem[]
): Promise<number> {
  await client.$transaction(async (tx) => {
    for (let i = 0; i < purchases.length; i++) {
      const p = purchases[i];
      const article = await ensureExpenseArticle(tx, {
        name: p.item.name,
        inventoryItemId: p.itemId,
      });
      await tx.expenseItem.create({
        data: {
          expenseId,
          articleId: article.id,
          quantity: p.quantity,
          unit: INVENTORY_UNIT_LABEL[p.item.unit],
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
    orderBy: { createdAt: 'asc' },
    include: { item: { select: { id: true, name: true, unit: true } } },
  },
} satisfies Prisma.ExpenseInclude;

/**
 * Complète le détail d'une dépense liée à un réappro qui vient d'être créé
 * (appelé par `batchRestock` APRÈS le commit de sa transaction, quand les
 * achats sont estampillés `expenseId`). Mêmes garde-fous que le backfill :
 * skip si des lignes existent déjà ou si la somme des achats ne correspond
 * pas au montant.
 */
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

/**
 * Génère rétroactivement les lignes de détail (`ExpenseItem`) des dépenses
 * liées à des achats d'inventaire (`InventoryPurchase.expenseId`, posé par
 * `batchRestock`) qui n'en ont pas encore. Garde-fou : on ne crée les lignes
 * que si la somme des achats égale exactement le montant de la dépense (vrai
 * pour les dépenses créées par `batchRestock`, sauf montant édité après coup) ;
 * sinon la dépense est ignorée et rapportée. Le montant de la dépense n'est
 * JAMAIS modifié. Idempotent (filtre `items: { none: {} }`).
 *
 * Partagé avec le script CLI (`prisma/backfill-expense-items.ts`), d'où le
 * `client` injectable.
 */
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rethrowUniqueName(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Une catégorie porte déjà ce nom.');
  }
  return err;
}
