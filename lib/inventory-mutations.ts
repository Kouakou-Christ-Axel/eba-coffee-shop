// lib/inventory-mutations.ts
//
// Écritures de l'inventaire périodique. Toutes les opérations multi-tables
// passent par une `$transaction`. La quantité courante (`currentQuantity`) et le
// prix moyen pondéré (`avgUnitCost`/PMP) sont dénormalisés sur l'article et
// maintenus de façon cohérente avec les achats et les comptages.
//
// Modèle PÉRIODIQUE : la consommation (sortie) n'est jamais saisie ; elle est
// déduite au comptage (= stock initial + achats − stock final). Le stock
// d'ouverture est matérialisé par un comptage « Stock initial » (consommation 0).

import { Prisma } from '@/generated/prisma/client';
import type { Prisma as PrismaNS } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  createExpense,
  deleteExpense,
  detailExpenseFromPurchases,
} from '@/lib/expense-mutations';
import { getInventorySettings } from '@/lib/inventory-settings-db';
import { getDaysSinceLastCount, listLowStockItems } from '@/lib/inventory';
import { sendInventoryReminderEmail } from '@/lib/email';
import {
  inventoryItemInputSchema,
  inventoryItemUpdateSchema,
  inventoryImportRowSchema,
  batchRestockSchema,
  batchCountSchema,
  type InventoryImportRowInput,
} from '@/lib/schemas/inventory';

type Tx = PrismaNS.TransactionClient;

/** Decimal Prisma → number. */
function num(d: Prisma.Decimal | number | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return typeof d === 'number' ? d : d.toNumber();
}

/**
 * Prix moyen pondéré (CUMP mobile) après un achat. Arrondi au FCFA.
 * Si le total est nul, on prend simplement le coût de l'achat.
 */
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

/**
 * Recalcule `currentQuantity` + `avgUnitCost` d'un article à partir du dernier
 * comptage (base), puis en rejouant les achats NON annulés postérieurs. Le PMP
 * mobile n'étant pas réversible ligne à ligne, on recalcule proprement après une
 * annulation de lot.
 */
async function recomputeItemFromHistory(tx: Tx, itemId: string): Promise<void> {
  const lastLine = await tx.inventoryCountLine.findFirst({
    where: { itemId },
    orderBy: [{ count: { date: 'desc' } }],
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

/**
 * Crée un comptage « d'ouverture » (consommation 0) pour matérialiser un stock
 * initial — utilisé à la création d'article et à l'import avec quantité initiale.
 */
async function createOpeningCount(
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

function rethrowUniqueSku(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Une référence (SKU) identique existe déjà.');
  }
  return err;
}

// ─── Génération de SKU (système) ──────────────────────────────────────────────
//
// Le SKU n'est jamais saisi par l'utilisateur : on le dérive du nom de la
// référence (préfixe lisible) puis on garantit l'unicité avec un suffixe
// incrémental. La recherche se fait dans la transaction courante, donc les
// références créées plus tôt dans le même import sont bien prises en compte.

function skuBase(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12)
    .replace(/-+$/g, '');
  return base || 'REF';
}

async function generateUniqueSku(tx: Tx, name: string): Promise<string> {
  const base = skuBase(name);
  for (let i = 1; i <= 999; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const exists = await tx.inventoryItem.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  // Repli improbable : suffixe aléatoire.
  return `${base}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// ─── Références (articles) ────────────────────────────────────────────────────

export async function createInventoryItem(
  input: unknown,
  createdById?: string
) {
  const data = inventoryItemInputSchema.parse(input);
  const initialQty = data.initialQuantity ?? 0;
  const initialCost = data.initialUnitCost ?? 0;
  try {
    return await prisma.$transaction(async (tx) => {
      const sku = await generateUniqueSku(tx, data.name);
      const item = await tx.inventoryItem.create({
        data: {
          sku,
          name: data.name,
          unit: data.unit ?? 'UNIT',
          category: data.category ?? null,
          safetyStock: data.safetyStock ?? 0,
          reorderPoint: data.reorderPoint ?? null,
          supplier: data.supplier ?? null,
          notes: data.notes ?? null,
          active: data.active ?? true,
        },
      });
      if (initialQty > 0) {
        await createOpeningCount(
          tx,
          new Date(),
          [{ itemId: item.id, qty: initialQty, unitCost: initialCost }],
          createdById
        );
      }
      return item;
    });
  } catch (err) {
    throw rethrowUniqueSku(err);
  }
}

export async function updateInventoryItem(id: string, input: unknown) {
  const data = inventoryItemUpdateSchema.parse(input);
  try {
    return await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.safetyStock !== undefined
          ? { safetyStock: data.safetyStock }
          : {}),
        ...(data.reorderPoint !== undefined
          ? { reorderPoint: data.reorderPoint }
          : {}),
        ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  } catch (err) {
    throw rethrowUniqueSku(err);
  }
}

/** Archivage (soft delete) — jamais de suppression définitive (préserve le journal). */
export async function archiveInventoryItem(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { active: false },
  });
}

export async function restoreInventoryItem(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { active: true },
  });
}

// ─── Réappro (achats par lot) ─────────────────────────────────────────────────

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

  // Dépense liée créée AVANT (sa propre transaction gère la numérotation de
  // reçu), AGRÉGÉE (sans lignes) : le schéma de saisie des items plafonne le
  // nombre de lignes et refuse les montants nuls, contraintes qui ne valent
  // pas pour ce chemin interne (import jusqu'à 1000 lignes, ligne gratuite à
  // coût 0). Le détail par article est généré APRÈS la transaction de réappro
  // (cf. plus bas), via le même chemin interne que le backfill.
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

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
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

  // Détail par article de la dépense liée, généré depuis les achats désormais
  // estampillés `expenseId` — chemin interne sans plafond ni positivité.
  // Best effort : le réappro et la dépense (agrégée, correcte) sont déjà
  // committés ; en cas d'échec ici, `pnpm db:backfill-expense-items` peut
  // régénérer le détail.
  if (expenseId) {
    try {
      await detailExpenseFromPurchases(expenseId);
    } catch {
      /* best effort */
    }
  }

  return result;
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
      // Supprime aussi ses lignes de détail (cascade DB) — voulu : le détail
      // suit le reçu. Le référentiel d'articles, lui, est préservé.
      await tx.expense.delete({ where: { id: batch.expenseId } });
    }
    return { batchId, itemsRestored: itemIds.length };
  });
}

// ─── Comptage périodique ──────────────────────────────────────────────────────

export async function recordInventoryCount(
  input: unknown,
  createdById?: string
) {
  const data = batchCountSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  return prisma.$transaction(
    async (tx) => {
      const count = await tx.inventoryCount.create({
        data: {
          date,
          label: data.label ?? null,
          note: data.note ?? null,
          createdById: createdById ?? null,
        },
      });
      for (const l of data.lines) {
        const item = await tx.inventoryItem.findUnique({
          where: { id: l.itemId },
          select: { avgUnitCost: true },
        });
        if (!item) throw new Error(`Article introuvable : ${l.itemId}`);

        const prevLine = await tx.inventoryCountLine.findFirst({
          where: { itemId: l.itemId, count: { date: { lt: date } } },
          orderBy: [{ count: { date: 'desc' } }],
          include: { count: { select: { date: true } } },
        });
        const isFirst = !prevLine;
        const opening = prevLine ? num(prevLine.countedQuantity) : 0;
        const since = prevLine?.count.date ?? null;

        const pAgg = await tx.inventoryPurchase.aggregate({
          where: {
            itemId: l.itemId,
            date: { ...(since ? { gt: since } : {}), lte: date },
            OR: [{ batchId: null }, { batch: { is: { canceledAt: null } } }],
          },
          _sum: { quantity: true },
        });
        const purchasesQuantity = num(pAgg._sum.quantity);
        const counted = l.countedQuantity;
        // Premier comptage = base ; pas de consommation à déduire.
        const consumption = isFirst ? 0 : opening + purchasesQuantity - counted;

        await tx.inventoryCountLine.create({
          data: {
            countId: count.id,
            itemId: l.itemId,
            openingQuantity: opening,
            purchasesQuantity,
            countedQuantity: counted,
            consumption,
            unitCostSnapshot: item.avgUnitCost,
          },
        });
        await tx.inventoryItem.update({
          where: { id: l.itemId },
          data: { currentQuantity: counted, lastCountedAt: date },
        });
      }
      return { countId: count.id, lineCount: data.lines.length };
    },
    { timeout: 30000 }
  );
}

// ─── Import catalogue ─────────────────────────────────────────────────────────

export type BulkImportResult = {
  created: number;
  updated: number;
  errors: string[];
};

/** Upsert d'un catalogue de références par `sku`. Idempotent ; renvoie un bilan. */
export async function bulkUpsertInventoryItems(
  rows: unknown[],
  createdById?: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
  await prisma.$transaction(
    async (tx) => {
      const openingLines: {
        itemId: string;
        qty: number;
        unitCost: number;
      }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const parsed = inventoryImportRowSchema.safeParse(rows[i]);
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'ligne invalide';
          result.errors.push(`Ligne ${i + 2} : ${msg}`);
          continue;
        }
        const r: InventoryImportRowInput = parsed.data;
        // SKU fourni → on cible une référence existante (mise à jour).
        // SKU absent → nouvelle référence : SKU généré par le système.
        const existing = r.sku
          ? await tx.inventoryItem.findUnique({
              where: { sku: r.sku },
              select: { id: true },
            })
          : null;
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              name: r.name,
              ...(r.category !== undefined ? { category: r.category } : {}),
              ...(r.unit !== undefined ? { unit: r.unit } : {}),
              ...(r.safetyStock !== undefined
                ? { safetyStock: r.safetyStock }
                : {}),
              ...(r.reorderPoint !== undefined
                ? { reorderPoint: r.reorderPoint }
                : {}),
              ...(r.supplier !== undefined ? { supplier: r.supplier } : {}),
            },
          });
          result.updated++;
        } else {
          const sku = r.sku ?? (await generateUniqueSku(tx, r.name));
          const created = await tx.inventoryItem.create({
            data: {
              sku,
              name: r.name,
              category: r.category ?? null,
              unit: r.unit ?? 'UNIT',
              safetyStock: r.safetyStock ?? 0,
              reorderPoint: r.reorderPoint ?? null,
              supplier: r.supplier ?? null,
            },
          });
          result.created++;
          if (r.initialQuantity && r.initialQuantity > 0) {
            openingLines.push({
              itemId: created.id,
              qty: r.initialQuantity,
              unitCost: r.initialUnitCost ?? 0,
            });
          }
        }
      }
      if (openingLines.length > 0) {
        await createOpeningCount(
          tx,
          new Date(),
          openingLines,
          createdById,
          'Stock initial (import)'
        );
      }
    },
    { timeout: 60000 }
  );
  return result;
}

// ─── Rappel email (dernier comptage trop ancien) ──────────────────────────────

/**
 * Envoie un rappel aux administrateurs si le dernier comptage date de plus de
 * `reminderDays` jours. Idempotent (≤ 1 envoi / 24 h via `lastReminderSentAt`).
 * Fire-and-forget : n'échoue jamais l'appelant.
 */
export async function maybeSendInventoryReminder(): Promise<void> {
  try {
    const settings = await getInventorySettings();
    if (!settings.reminderEnabled) return;

    const days = await getDaysSinceLastCount();
    if (days === null || days <= settings.reminderDays) return;

    const row = await prisma.inventorySettings.findUnique({
      where: { id: 'singleton' },
      select: { lastReminderSentAt: true },
    });
    const last = row?.lastReminderSentAt;
    if (last && Date.now() - last.getTime() < 24 * 60 * 60 * 1000) return;

    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) return;

    const lowStock = await listLowStockItems();
    await sendInventoryReminderEmail({
      daysSince: days,
      recipients,
      lowStockItems: lowStock.slice(0, 10).map((i) => ({
        name: i.name,
        quantity: i.currentQuantity,
        unit: i.unit,
      })),
    });

    await prisma.inventorySettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastReminderSentAt: new Date() },
      update: { lastReminderSentAt: new Date() },
    });
  } catch (err) {
    console.error('[inventory] rappel email échoué', err);
  }
}
