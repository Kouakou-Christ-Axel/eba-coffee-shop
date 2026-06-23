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
} from '@/lib/schemas/expense';

// ─── Catégories ───────────────────────────────────────────────────────────────

export async function createExpenseCategory(input: unknown) {
  const { name } = expenseCategoryInputSchema.parse(input);
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
      data: { deletedAt: null, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }
  try {
    return await prisma.expenseCategory.create({
      data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  } catch (err) {
    throw rethrowUniqueName(err);
  }
}

export async function updateExpenseCategory(id: string, input: unknown) {
  const { name } = expenseCategoryUpdateSchema.parse(input);
  try {
    return await prisma.expenseCategory.update({
      where: { id },
      data: { name },
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

// ─── Dépenses ─────────────────────────────────────────────────────────────────

export async function createExpense(input: unknown, createdById?: string) {
  const data = expenseInputSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;
  // Numéro de reçu : compteur du mois civil de la dépense. Figé à la création.
  const receiptPeriod = receiptPeriodFromDate(date);

  // Retry sur conflit de l'index unique (receiptPeriod, receiptSeq) en cas de
  // saisies concurrentes sur le même mois.
  for (let attempt = 0; attempt < RECEIPT_NUMBER_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const receiptSeq = await getNextReceiptSeq(tx, receiptPeriod);
        return tx.expense.create({
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
export async function updateExpense(id: string, input: unknown) {
  const data = expenseUpdateSchema.parse(input);
  return prisma.expense.update({
    where: { id },
    data: {
      ...(data.date !== undefined
        ? { date: parseDateOnlyToUTC(data.date)! }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.paymentMethod !== undefined
        ? { paymentMethod: data.paymentMethod }
        : {}),
      ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.receiptUrl !== undefined ? { receiptUrl: data.receiptUrl } : {}),
    },
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
