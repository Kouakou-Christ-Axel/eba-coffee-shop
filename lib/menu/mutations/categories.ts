import prisma from '@/lib/prisma';
import { slugify, assertSameSet } from './helpers';
import {
  createCategorySchema,
  updateCategorySchema,
  type CategoryInput,
  type CategoryUpdate,
} from './schemas';

export async function createCategory(input: CategoryInput) {
  const { name, scheduleId, advanceOrderDays } =
    createCategorySchema.parse(input);
  const existing = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  return prisma.menuCategory.create({
    data: {
      name,
      slug: slugify(name),
      sortOrder: existing.length,
      scheduleId: scheduleId ?? null,
      advanceOrderDays: advanceOrderDays ?? null,
    },
  });
}

// Mise à jour PARTIELLE (même règle que `updateProduct`) : un champ absent
// reste inchangé, `scheduleId: null` efface volontairement le planning.
export async function updateCategory(id: string, input: CategoryUpdate) {
  const data = updateCategorySchema.parse(input);
  return prisma.menuCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.scheduleId !== undefined && { scheduleId: data.scheduleId }),
      ...(data.advanceOrderDays !== undefined && {
        advanceOrderDays: data.advanceOrderDays,
      }),
    },
  });
}

export async function deleteCategory(id: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const cat = await tx.menuCategory.findUnique({
      where: { id },
      select: { slug: true, deletedAt: true },
    });
    if (!cat) throw new Error('Catégorie introuvable');
    await tx.product.updateMany({
      where: { categoryId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    return tx.menuCategory.update({
      where: { id },
      data: { deletedAt: now, slug: `${cat.slug}-deleted-${id}` },
    });
  });
}

export async function toggleCategoryAvailability(id: string) {
  const cat = await prisma.menuCategory.findUnique({ where: { id } });
  if (!cat) throw new Error('Catégorie introuvable');
  return prisma.menuCategory.update({
    where: { id },
    data: { available: !cat.available },
  });
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const all = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Catégorie introuvable');
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.menuCategory.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.menuCategory.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

export async function reorderCategories(orderedIds: string[]) {
  const current = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  assertSameSet(
    orderedIds,
    current.map((c) => c.id),
    'catégories'
  );

  return prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.menuCategory.update({
        where: { id },
        data: { sortOrder: index },
      });
    }
  });
}
