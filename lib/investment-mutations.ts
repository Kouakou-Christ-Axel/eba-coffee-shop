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
  // Le nom reste unique globalement. Si une source du même nom a été soft delete,
  // on la « ressuscite » (deletedAt → null) au lieu d'échouer.
  const existing = await prisma.investmentSource.findUnique({
    where: { name },
  });
  const max = await prisma.investmentSource.aggregate({
    _max: { sortOrder: true },
  });
  if (existing) {
    if (existing.deletedAt === null) {
      throw new Error('Une source porte déjà ce nom.');
    }
    return prisma.investmentSource.update({
      where: { id: existing.id },
      data: { deletedAt: null, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
  }
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

// Soft delete : on retire la source des sélecteurs/listes sans toucher aux
// apports rattachés (qui conservent leur libellé via la relation).
export async function deleteInvestmentSource(id: string) {
  return prisma.investmentSource.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
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
