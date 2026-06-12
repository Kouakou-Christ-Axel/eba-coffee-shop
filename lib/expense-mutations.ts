// lib/expense-mutations.ts
//
// Écritures pour le suivi des dépenses (catégories + dépenses). Valide via les
// schémas Zod centralisés (lib/schemas/expense.ts), parse les dates civiles en
// @db.Date, et traduit les erreurs Prisma en messages lisibles.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
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
  return prisma.expense.create({
    data: {
      date: parseDateOnlyToUTC(data.date)!,
      amount: data.amount,
      categoryId: data.categoryId,
      paymentMethod: data.paymentMethod ?? 'CASH',
      supplier: data.supplier ?? null,
      note: data.note ?? null,
      receiptUrl: data.receiptUrl ?? null,
      createdById: createdById ?? null,
    },
  });
}

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
