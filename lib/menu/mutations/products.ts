import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { SupplementGroupInput } from '@/lib/schemas/menu';
import { syncSupplementGroups } from '@/lib/supplement-groups-sync';
import { triggerRestockAlerts } from '@/lib/restock-alerts';
import {
  productInputSchema,
  productUpdateSchema,
  type ProductInput,
  type ProductUpdate,
} from './schemas';
import { assertSameSet } from './helpers';

export async function createProduct(input: ProductInput) {
  const data = productInputSchema.parse(input);
  const existing = await prisma.product.findMany({
    where: { categoryId: data.categoryId, deletedAt: null },
    select: { id: true },
  });
  return prisma.product.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      coutMatiere: data.coutMatiere,
      coutEmballage: data.coutEmballage,
      imageUrl: data.imageUrl ?? null,
      sortOrder: existing.length,
      featured: data.featured,
      featuredOrder: data.featuredOrder,
      featuredBadge: data.featuredBadge ?? null,
      stockQuantity: data.stockQuantity ?? null,
      unavailableUntil: data.unavailableUntil
        ? new Date(data.unavailableUntil)
        : null,
      scheduleId: data.scheduleId ?? null,
      advanceOrderDays: data.advanceOrderDays ?? null,
      requiresDeposit: data.requiresDeposit ?? false,
      supplementGroups: {
        create: data.supplementGroups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          available: g.available,
          minSelect: g.minSelect ?? null,
          maxSelect: g.maxSelect ?? null,
          sortOrder: gi,
          options: {
            create: g.options.map((o, oi) => ({
              name: o.name,
              price: o.price,
              available: o.available,
              stockQuantity: o.stockQuantity ?? null,
              sortOrder: oi,
            })),
          },
        })),
      },
    },
  });
}

export async function updateProduct(id: string, input: ProductUpdate) {
  const data = productUpdateSchema.parse(input);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error('Produit introuvable');

  // N'écrit QUE les champs scalaires explicitement fournis (un champ absent =
  // inchangé). `featuredBadge: null` reste un effacement volontaire et valide.
  const scalar = {
    ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    ...(data.featured !== undefined && { featured: data.featured }),
    ...(data.featuredOrder !== undefined && {
      featuredOrder: data.featuredOrder,
    }),
    ...(data.featuredBadge !== undefined && {
      featuredBadge: data.featuredBadge,
    }),
    ...(data.coutMatiere !== undefined && { coutMatiere: data.coutMatiere }),
    ...(data.coutEmballage !== undefined && {
      coutEmballage: data.coutEmballage,
    }),
    ...(data.stockQuantity !== undefined && {
      stockQuantity: data.stockQuantity,
    }),
    ...(data.unavailableUntil !== undefined && {
      unavailableUntil: data.unavailableUntil
        ? new Date(data.unavailableUntil)
        : null,
    }),
    ...(data.scheduleId !== undefined && { scheduleId: data.scheduleId }),
    ...(data.advanceOrderDays !== undefined && {
      advanceOrderDays: data.advanceOrderDays,
    }),
    ...(data.requiresDeposit !== undefined && {
      requiresDeposit: data.requiresDeposit,
    }),
  };

  // Les groupes de suppléments ne sont remplacés QUE s'ils sont fournis. Absents
  // → on ne touche pas aux suppléments existants (pas de transaction inutile).
  const updated =
    data.supplementGroups === undefined
      ? await prisma.product.update({ where: { id }, data: scalar })
      : await updateSupplementGroups(id, scalar, data.supplementGroups);

  // Stock, pause ou goûts modifiés : un article attendu est peut-être de
  // retour (lib/restock-alerts.ts).
  if (
    data.stockQuantity !== undefined ||
    data.unavailableUntil !== undefined ||
    data.supplementGroups !== undefined
  ) {
    triggerRestockAlerts();
  }
  return updated;
}

export async function updateSupplementGroups(
  productId: string,
  scalar: Prisma.ProductUpdateInput,
  groups: SupplementGroupInput[]
) {
  return prisma.$transaction(async (tx) => {
    await syncSupplementGroups(tx, { productId }, groups);
    return tx.product.update({ where: { id: productId }, data: scalar });
  });
}

export async function moveProduct(id: string, direction: 'up' | 'down') {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { categoryId: true },
  });
  if (!product) throw new Error('Produit introuvable');

  const all = await prisma.product.findMany({
    where: { categoryId: product.categoryId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((p) => p.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.product.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.product.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

export async function reorderProducts(
  categoryId: string,
  orderedIds: string[]
) {
  const current = await prisma.product.findMany({
    where: { categoryId, deletedAt: null },
    select: { id: true },
  });
  assertSameSet(
    orderedIds,
    current.map((p) => p.id),
    'produits'
  );

  return prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.product.update({ where: { id }, data: { sortOrder: index } });
    }
  });
}

// Soft delete : on marque le produit comme supprimé (conservé en base, masqué
// partout). Ses suppléments restent rattachés.
export async function deleteProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function toggleProductAvailability(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { available: !p.available },
  });
}

export async function toggleProductFeatured(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { featured: !p.featured },
  });
}
