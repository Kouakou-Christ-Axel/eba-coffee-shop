// lib/revenue-adjustment-mutations.ts
//
// Écritures pour les régularisations de recette (ajustements manuels du CA).
// Valide via les schémas Zod centralisés (lib/schemas/revenue-adjustment.ts) et
// parse les dates civiles en @db.Date. Miroir de lib/expense-mutations.ts.

import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import {
  revenueAdjustmentInputSchema,
  revenueAdjustmentUpdateSchema,
} from '@/lib/schemas/revenue-adjustment';

export async function createRevenueAdjustment(
  input: unknown,
  createdById?: string
) {
  const data = revenueAdjustmentInputSchema.parse(input);
  return prisma.revenueAdjustment.create({
    data: {
      date: parseDateOnlyToUTC(data.date)!,
      amount: data.amount,
      paymentMode: data.paymentMode ?? 'CASH',
      note: data.note ?? null,
      createdById: createdById ?? null,
    },
  });
}

export async function updateRevenueAdjustment(id: string, input: unknown) {
  const data = revenueAdjustmentUpdateSchema.parse(input);
  return prisma.revenueAdjustment.update({
    where: { id },
    data: {
      ...(data.date !== undefined
        ? { date: parseDateOnlyToUTC(data.date)! }
        : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.paymentMode !== undefined
        ? { paymentMode: data.paymentMode }
        : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
    },
  });
}

export async function deleteRevenueAdjustment(id: string) {
  return prisma.revenueAdjustment.delete({ where: { id } });
}
