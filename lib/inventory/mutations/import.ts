import prisma from '@/lib/prisma';
import {
  inventoryImportRowSchema,
  type InventoryImportRowInput,
} from '@/lib/schemas/inventory';
import { createOpeningCount } from './helpers';
import { generateUniqueSku } from './sku';

export type BulkImportResult = {
  created: number;
  updated: number;
  errors: string[];
};

/** Upsert d'un catalogue de références par `sku`. */
export async function bulkUpsertInventoryItems(
  rows: unknown[],
  createdById?: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, updated: 0, errors: [] };
  await prisma.$transaction(
    async (tx) => {
      const openingLines: {
        itemId: string;
        qty: number;
        unitCost: number;
      }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const parsed = inventoryImportRowSchema.safeParse(rows[i]);
        if (!parsed.success) {
          const msg = parsed.error.issues[0]?.message ?? 'ligne invalide';
          result.errors.push(`Ligne ${i + 2} : ${msg}`);
          continue;
        }
        const r: InventoryImportRowInput = parsed.data;
        // SKU fourni → on cible une référence existante (mise à jour).
        // SKU absent → nouvelle référence : SKU généré par le système.
        const existing = r.sku
          ? await tx.inventoryItem.findUnique({
              where: { sku: r.sku },
              select: { id: true },
            })
          : null;
        if (existing) {
          await tx.inventoryItem.update({
            where: { id: existing.id },
            data: {
              name: r.name,
              ...(r.category !== undefined ? { category: r.category } : {}),
              ...(r.unit !== undefined ? { unit: r.unit } : {}),
              ...(r.safetyStock !== undefined
                ? { safetyStock: r.safetyStock }
                : {}),
              ...(r.reorderPoint !== undefined
                ? { reorderPoint: r.reorderPoint }
                : {}),
              ...(r.supplier !== undefined ? { supplier: r.supplier } : {}),
            },
          });
          result.updated++;
        } else {
          const sku = r.sku ?? (await generateUniqueSku(tx, r.name));
          const created = await tx.inventoryItem.create({
            data: {
              sku,
              name: r.name,
              category: r.category ?? null,
              unit: r.unit ?? 'UNIT',
              safetyStock: r.safetyStock ?? 0,
              reorderPoint: r.reorderPoint ?? null,
              supplier: r.supplier ?? null,
            },
          });
          result.created++;
          if (r.initialQuantity && r.initialQuantity > 0) {
            openingLines.push({
              itemId: created.id,
              qty: r.initialQuantity,
              unitCost: r.initialUnitCost ?? 0,
            });
          }
        }
      }
      if (openingLines.length > 0) {
        await createOpeningCount(
          tx,
          new Date(),
          openingLines,
          createdById,
          'Stock initial (import)'
        );
      }
    },
    { timeout: 60000 }
  );
  return result;
}
