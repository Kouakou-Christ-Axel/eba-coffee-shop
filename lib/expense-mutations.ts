// lib/expense-mutations.ts
//
// Écritures pour le suivi des dépenses (catégories + dépenses + détail par
// article). Valide via les schémas Zod centralisés (lib/schemas/expense.ts),
// parse les dates civiles en @db.Date, et traduit les erreurs Prisma en
// messages lisibles. Le rapprochement d'articles (dédup/alias) vit dans
// lib/expense-matching.ts ; la conversion d'unités dans lib/expense-units.ts.

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
  expenseArticleSettingsSchema,
  resolveExpenseItemAmount,
  type ExpenseItemInput,
} from '@/lib/schemas/expense';
import {
  ensureArticle,
  resolveArticle,
  learnAlias,
  normalizeLabel,
  normalizeSupplierKey,
} from '@/lib/expense-matching';
import { toBaseQty } from '@/lib/expense-units';

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

// ─── Référentiel d'articles ───────────────────────────────────────────────────

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
  return prisma.expenseArticle.update({
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
}

/**
 * Fusionne `sourceId` dans `targetId` (dédoublonnage) : toutes les lignes de
 * dépense et tous les alias pointant vers la source sont re-rattachés à la
 * cible, puis la source est archivée (`archivedAt`) et marquée `mergedIntoId`.
 * Ne supprime JAMAIS de ligne. Les alias en conflit (même (alias, supplierKey)
 * déjà présent sur la cible) sont supprimés plutôt que déplacés, pour ne pas
 * violer l'unicité `(alias, supplierKey)`.
 */
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

/**
 * Re-rattache une ligne de dépense à un autre article (correction d'un
 * rapprochement erroné/absent) et apprend l'alias `rawLabel` → nouvel article
 * pour la prochaine saisie. Aucun effet sur le stock (Phase 3, hors périmètre
 * ici). Renvoie les deux articles affectés pour permettre à l'appelant de
 * recalculer leurs statistiques de fréquence.
 */
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

// ─── Dépenses ─────────────────────────────────────────────────────────────────

const expenseItemsInclude = {
  items: {
    orderBy: { sortOrder: 'asc' },
    include: { article: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ExpenseInclude;

/** Retrouve (ou crée) l'article visé par une ligne, en respectant `articleId`
 * explicite en priorité (ressuscité si archivé), sinon `articleName` (ou
 * `rawLabel` à défaut) via `ensureArticle` (dédup/auto-création). */
async function resolveItemArticle(
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

async function createExpenseItems(
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

/** Somme des montants effectifs des lignes ; lève une erreur explicite si une
 * ligne n'a ni montant ni de quoi le dériver. */
function sumExpenseItems(items: ExpenseItemInput[]): number {
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

export async function createExpense(input: unknown, createdById?: string) {
  const data = expenseInputSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  // Numéro de reçu : compteur du mois civil de la dépense. Figé à la création.
  const receiptPeriod = receiptPeriodFromDate(date);

  if (data.items && data.items.length > 0) {
    const sum = sumExpenseItems(data.items);
    if (sum !== data.amount) {
      throw new Error(
        `La somme des lignes (${sum} F) doit égaler le montant de la dépense (${data.amount} F).`
      );
    }
  }

  // Retry sur conflit de l'index unique (receiptPeriod, receiptSeq) en cas de
  // saisies concurrentes sur le même mois.
  for (let attempt = 0; attempt < RECEIPT_NUMBER_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const receiptSeq = await getNextReceiptSeq(tx, receiptPeriod);
        const expense = await tx.expense.create({
          data: {
            date,
            amount: data.amount,
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
        if (data.items && data.items.length > 0) {
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
// n'est donc jamais modifié ici — même si la `date` est éditée vers un autre
// mois. Détail : `items` fourni (tableau) = remplacement complet des lignes ;
// `items: null` = retrait du détail (la dépense redevient « globale ») ;
// `items` absent = détail non touché (garde-fou : changer `amount` seul sur
// une dépense déjà détaillée est refusé, il faut passer par `items`).
export async function updateExpense(id: string, input: unknown) {
  const data = expenseUpdateSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id },
      select: { amount: true, _count: { select: { items: true } } },
    });
    if (!existing) throw new Error('Dépense introuvable.');

    const itemsProvided = data.items !== undefined;
    if (
      !itemsProvided &&
      data.amount !== undefined &&
      existing._count.items > 0
    ) {
      throw new Error(
        'Cette dépense est détaillée : modifiez ses lignes (items), ou retirez le détail (items: null) pour changer le montant seul.'
      );
    }

    const expense = await tx.expense.update({
      where: { id },
      data: {
        ...(data.date !== undefined
          ? { date: parseDateOnlyToUTC(data.date)! }
          : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
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

    if (data.items === null) {
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      return expense;
    }

    if (data.items) {
      const finalAmount = data.amount ?? existing.amount;
      const sum = sumExpenseItems(data.items);
      if (sum !== finalAmount) {
        throw new Error(
          `La somme des lignes (${sum} F) doit égaler le montant de la dépense (${finalAmount} F).`
        );
      }
      await tx.expenseItem.deleteMany({ where: { expenseId: id } });
      await createExpenseItems(tx, id, data.items);
      return tx.expense.findUniqueOrThrow({
        where: { id },
        include: expenseItemsInclude,
      });
    }

    return expense;
  });
}

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

// ─── Génération du détail depuis les achats d'inventaire ──────────────────────
//
// Une réappro (`lib/inventory-mutations.ts::batchRestock`) peut créer une
// dépense liée (`InventoryPurchase.expenseId`) sans détail par article : ces
// deux fonctions génèrent rétroactivement les `ExpenseItem` correspondants,
// en réutilisant le même référentiel d'articles (unification réappro ↔
// dépenses). Le montant de la dépense n'est JAMAIS modifié.

// Unité d'inventaire (`InventoryUnit`) → unité de base des articles de dépense
// (`BASE_UNITS`). `BOX` (carton/lot) n'a pas d'équivalent naturel : traité
// comme unité atomique (`unite`).
const INVENTORY_UNIT_TO_BASE: Record<string, string> = {
  UNIT: 'unite',
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'mL',
  BOX: 'unite',
};

type PurchaseWithItem = {
  itemId: string;
  quantity: Prisma.Decimal;
  unitCost: number;
  totalCost: number;
  item: { id: string; name: string; unit: string };
};

async function createExpenseItemsFromPurchases(
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
 * que si la somme des achats égale exactement le montant de la dépense ;
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

/**
 * Tente de rapprocher les lignes non liées (`articleId IS NULL`) via
 * `resolveArticle` : lie automatiquement en cas de correspondance UNIQUE
 * (alias ou nom normalisé exact) et apprend l'alias correspondant ; laisse de
 * côté les lignes ambiguës (plusieurs candidats) ou sans correspondance.
 * `dry: true` calcule le rapport sans écrire. `supplierKey` force la clé
 * fournisseur (sinon dérivée du fournisseur de chaque dépense).
 */
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
