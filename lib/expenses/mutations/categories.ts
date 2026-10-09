import prisma from '@/lib/prisma';
import {
  expenseCategoryInputSchema,
  expenseCategoryUpdateSchema,
} from '@/lib/schemas/expense';
import { rethrowUniqueName } from './helpers';

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
