import prisma from '@/lib/prisma';
import {
  inventoryItemInputSchema,
  inventoryItemUpdateSchema,
} from '@/lib/schemas/inventory';
import { createOpeningCount } from './helpers';
import { rethrowUniqueSku, generateUniqueSku } from './sku';

export async function createInventoryItem(
  input: unknown,
  createdById?: string
) {
  const data = inventoryItemInputSchema.parse(input);
  const initialQty = data.initialQuantity ?? 0;
  const initialCost = data.initialUnitCost ?? 0;
  try {
    return await prisma.$transaction(async (tx) => {
      const sku = await generateUniqueSku(tx, data.name);
      const item = await tx.inventoryItem.create({
        data: {
          sku,
          name: data.name,
          unit: data.unit ?? 'UNIT',
          category: data.category ?? null,
          safetyStock: data.safetyStock ?? 0,
          reorderPoint: data.reorderPoint ?? null,
          supplier: data.supplier ?? null,
          notes: data.notes ?? null,
          active: data.active ?? true,
        },
      });
      if (initialQty > 0) {
        await createOpeningCount(
          tx,
          new Date(),
          [{ itemId: item.id, qty: initialQty, unitCost: initialCost }],
          createdById
        );
      }
      return item;
    });
  } catch (err) {
    throw rethrowUniqueSku(err);
  }
}

export async function updateInventoryItem(id: string, input: unknown) {
  const data = inventoryItemUpdateSchema.parse(input);
  try {
    return await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.safetyStock !== undefined
          ? { safetyStock: data.safetyStock }
          : {}),
        ...(data.reorderPoint !== undefined
          ? { reorderPoint: data.reorderPoint }
          : {}),
        ...(data.supplier !== undefined ? { supplier: data.supplier } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  } catch (err) {
    throw rethrowUniqueSku(err);
  }
}

/** Archivage (soft delete) — jamais de suppression définitive (préserve le journal). */
export async function archiveInventoryItem(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { active: false },
  });
}

export async function restoreInventoryItem(id: string) {
  return prisma.inventoryItem.update({
    where: { id },
    data: { active: true },
  });
}
