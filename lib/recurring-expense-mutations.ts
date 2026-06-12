// lib/recurring-expense-mutations.ts
//
// Écritures pour les modèles de dépense récurrente. Valide via les schémas Zod
// centralisés (lib/schemas/expense.ts).

import prisma from '@/lib/prisma';
import {
  recurringExpenseInputSchema,
  recurringExpenseUpdateSchema,
} from '@/lib/schemas/expense';

export async function createRecurringExpense(input: unknown) {
  const data = recurringExpenseInputSchema.parse(input);
  return prisma.recurringExpense.create({
    data: {
      label: data.label,
      categoryId: data.categoryId,
      expectedAmount: data.expectedAmount ?? null,
      dayOfMonth: data.dayOfMonth ?? null,
      active: data.active ?? true,
    },
  });
}

export async function updateRecurringExpense(id: string, input: unknown) {
  const data = recurringExpenseUpdateSchema.parse(input);
  return prisma.recurringExpense.update({
    where: { id },
    data: {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.expectedAmount !== undefined
        ? { expectedAmount: data.expectedAmount }
        : {}),
      ...(data.dayOfMonth !== undefined ? { dayOfMonth: data.dayOfMonth } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
}

export async function deleteRecurringExpense(id: string) {
  return prisma.recurringExpense.delete({ where: { id } });
}
