// lib/investment-mutations.ts
//
// Écritures pour les investissements (apports / financements) : sources + apports.
// Miroir de lib/expense-mutations.ts. Valide via les schémas Zod centralisés
// (lib/schemas/investment.ts), parse les dates civiles en @db.Date, et traduit
// les erreurs Prisma en messages lisibles.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  investmentSourceInputSchema,
  investmentSourceUpdateSchema,
  investmentInputSchema,
  investmentUpdateSchema,
} from '@/lib/schemas/investment';

// ─── Sources de financement ────────────────────────────────────────────────────

export async function createInvestmentSource(input: unknown) {
  const { name } = investmentSourceInputSchema.parse(input);
  const max = await prisma.investmentSource.aggregate({
    _max: { sortOrder: true },
  });
  try {
    return await prisma.investmentSource.create({
      data: { name, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  } catch (err) {
    throw rethrowUniqueName(err);
  }
}

export async function updateInvestmentSource(id: string, input: unknown) {
  const { name } = investmentSourceUpdateSchema.parse(input);
  try {
    return await prisma.investmentSource.update({
      where: { id },
      data: { name },
    });
  } catch (err) {
    throw rethrowUniqueName(err);
  }
}

export async function deleteInvestmentSource(id: string) {
  try {
    return await prisma.investmentSource.delete({ where: { id } });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2003'
    ) {
      throw new Error(
        'Impossible de supprimer : des apports utilisent cette source.'
      );
    }
    throw err;
  }
}

// ─── Apports ────────────────────────────────────────────────────────────────────

export async function createInvestment(input: unknown, createdById?: string) {
  const data = investmentInputSchema.parse(input);
  return prisma.investment.create({
    data: {
      date: parseDateOnlyToUTC(data.date)!,
      amount: data.amount,
      sourceId: data.sourceId,
      paymentMethod: data.paymentMethod ?? 'CASH',
      financier: data.financier ?? null,
      note: data.note ?? null,
      documentUrl: data.documentUrl ?? null,
      reimbursable: data.reimbursable ?? false,
      amountRepaid: data.amountRepaid ?? 0,
      dueDate: data.dueDate ? parseDateOnlyToUTC(data.dueDate)! : null,
      createdById: createdById ?? null,
    },
  });
}

export async function updateInvestment(id: string, input: unknown) {
  const data = investmentUpdateSchema.parse(input);
  return prisma.investment.update({
    where: { id },
    data: {
      ...(data.date !== undefined
        ? { date: parseDateOnlyToUTC(data.date)! }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.sourceId !== undefined ? { sourceId: data.sourceId } : {}),
      ...(data.paymentMethod !== undefined
        ? { paymentMethod: data.paymentMethod }
        : {}),
      ...(data.financier !== undefined ? { financier: data.financier } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.documentUrl !== undefined
        ? { documentUrl: data.documentUrl }
        : {}),
      ...(data.reimbursable !== undefined
        ? { reimbursable: data.reimbursable }
        : {}),
      ...(data.amountRepaid !== undefined
        ? { amountRepaid: data.amountRepaid }
        : {}),
      ...(data.dueDate !== undefined
        ? { dueDate: data.dueDate ? parseDateOnlyToUTC(data.dueDate)! : null }
        : {}),
    },
  });
}

export async function deleteInvestment(id: string) {
  return prisma.investment.delete({ where: { id } });
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function rethrowUniqueName(err: unknown): unknown {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    return new Error('Une source porte déjà ce nom.');
  }
  return err;
}
