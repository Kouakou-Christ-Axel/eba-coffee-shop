// lib/inventory-import.ts
//
// Logique « métier » de l'import inventaire : résolution SKU → itemId pour les
// modes « comptage » et « achats ». Volontairement séparé du module Excel
// (lib/inventory-excel.ts) qui ne fait que de la (dé)sérialisation. On branche
// les mutations existantes (recordInventoryCount / batchRestock) sans dupliquer
// aucune logique d'écriture.

import prisma from '@/lib/prisma';
import { recordInventoryCount, batchRestock } from '@/lib/inventory-mutations';

/** Construit une Map sku → itemId pour les SKU non vides fournis. */
async function resolveSkuMap(skus: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(skus)];
  if (unique.length === 0) return new Map();
  const items = await prisma.inventoryItem.findMany({
    where: { sku: { in: unique } },
    select: { id: true, sku: true },
  });
  return new Map(items.map((i) => [i.sku, i.id]));
}

/**
 * Import d'un comptage : résout les SKU, construit les lignes valides et délègue
 * à recordInventoryCount. Les lignes invalides (sku manquant/inconnu) sont
 * collectées dans `errors` sans interrompre l'import.
 */
export async function importInventoryCount(
  rows: { sku?: string; countedQuantity?: unknown }[],
  meta: { date: string; label?: string | null; note?: string | null },
  createdById?: string
): Promise<{ countId?: string; lineCount: number; errors: string[] }> {
  const errors: string[] = [];
  const skus = rows.map((r) => r.sku).filter((s): s is string => Boolean(s));
  const skuMap = await resolveSkuMap(skus);

  const lines: { itemId: string; countedQuantity: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    if (!r.sku) {
      errors.push(`Ligne ${rowNum} : sku manquant`);
      continue;
    }
    const itemId = skuMap.get(r.sku);
    if (!itemId) {
      errors.push(`Ligne ${rowNum} : référence inconnue (${r.sku})`);
      continue;
    }
    lines.push({ itemId, countedQuantity: Number(r.countedQuantity) });
  }

  if (lines.length === 0) {
    return { lineCount: 0, errors };
  }

  try {
    const result = await recordInventoryCount(
      {
        date: meta.date,
        label: meta.label ?? null,
        note: meta.note ?? null,
        lines,
      },
      createdById
    );
    return { countId: result.countId, lineCount: lines.length, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { lineCount: lines.length, errors };
  }
}

/**
 * Import d'un réappro (achats) : résout les SKU, construit les lignes valides et
 * délègue à batchRestock (source IMPORT). Les lignes invalides sont collectées
 * dans `errors` sans interrompre l'import.
 */
export async function importInventoryPurchases(
  rows: { sku?: string; quantity?: unknown; unitCost?: unknown }[],
  meta: {
    date: string;
    supplier?: string | null;
    note?: string | null;
    createExpense?: boolean;
    expenseCategoryId?: string | null;
    paymentMethod?: 'CASH' | 'WAVE' | 'BANK' | 'OTHER';
  },
  createdById?: string
): Promise<{ batchId?: string; lineCount: number; errors: string[] }> {
  const errors: string[] = [];
  const skus = rows.map((r) => r.sku).filter((s): s is string => Boolean(s));
  const skuMap = await resolveSkuMap(skus);

  const lines: { itemId: string; quantity: number; unitCost: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    if (!r.sku) {
      errors.push(`Ligne ${rowNum} : sku manquant`);
      continue;
    }
    const itemId = skuMap.get(r.sku);
    if (!itemId) {
      errors.push(`Ligne ${rowNum} : référence inconnue (${r.sku})`);
      continue;
    }
    lines.push({
      itemId,
      quantity: Number(r.quantity),
      unitCost: Number(r.unitCost),
    });
  }

  if (lines.length === 0) {
    return { lineCount: 0, errors };
  }

  try {
    const result = await batchRestock(
      {
        date: meta.date,
        supplier: meta.supplier ?? null,
        note: meta.note ?? null,
        createExpense: meta.createExpense,
        expenseCategoryId: meta.expenseCategoryId ?? null,
        paymentMethod: meta.paymentMethod,
        lines,
      },
      createdById,
      'IMPORT'
    );
    return { batchId: result.batchId, lineCount: lines.length, errors };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { lineCount: lines.length, errors };
  }
}
