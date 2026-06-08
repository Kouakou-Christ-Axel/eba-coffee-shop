// lib/cash-closing-mutations.ts
//
// Écriture de la clôture de caisse. Une clôture par jour civil (upsert sur la
// date). Les chiffres calculés (ventes/dépenses espèces, théorique, écart) sont
// figés au moment de l'enregistrement.

import prisma from '@/lib/prisma';
import { parseDateOnlyToUTC } from '@/lib/timezone';
import { cashClosingInputSchema } from '@/lib/schemas/cash-closing';
import { getCashFigures } from '@/lib/cash-closing';
import { computeClosing } from '@/lib/cash-closing-compute';

export async function saveCashClosing(input: unknown, closedById?: string) {
  const data = cashClosingInputSchema.parse(input);
  const date = parseDateOnlyToUTC(data.date)!;

  const figures = await getCashFigures(date);
  const { expectedCash, difference } = computeClosing({
    openingFloat: data.openingFloat,
    cashSales: figures.cashSales,
    cashExpenses: figures.cashExpenses,
    countedCash: data.countedCash,
  });

  const payload = {
    openingFloat: data.openingFloat,
    countedCash: data.countedCash,
    cashSales: figures.cashSales,
    cashExpenses: figures.cashExpenses,
    expectedCash,
    difference,
    note: data.note ?? null,
    closedById: closedById ?? null,
  };

  return prisma.cashClosing.upsert({
    where: { date },
    create: { date, ...payload },
    update: payload,
  });
}

export async function deleteCashClosing(id: string) {
  return prisma.cashClosing.delete({ where: { id } });
}
