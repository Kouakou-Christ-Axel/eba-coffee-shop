// lib/expense-mutations.ts
//
// Écritures pour le suivi des dépenses (catégories + dépenses). Valide via les
// schémas Zod centralisés (lib/schemas/expense.ts), parse les dates civiles en
// @db.Date, et traduit les erreurs Prisma en messages lisibles.

import { Prisma } from '@/generated/prisma/client';
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
  const max = await prisma.expenseCategory.aggregate({
    _max: { sortOrder: true },
  });
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

export async function deleteExpenseCategory(id: string) {
  try {
    return await prisma.expenseCategory.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw new Error(
        'Impossible de supprimer : des dépenses utilisent cette catégorie.'
      );
    }
    throw err;
  }
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
