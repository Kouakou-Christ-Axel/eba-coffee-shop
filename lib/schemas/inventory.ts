// lib/schemas/inventory.ts
//
// Schémas Zod centralisés pour l'inventaire périodique (références, achats,
// comptages, réglages, import). Réutilisés par les server actions, les routes
// et le serveur MCP. Conformément à CLAUDE.md : pas de redéclaration inline.

import { z } from 'zod';
import {
  INVENTORY_SKU_MAX,
  INVENTORY_NAME_MAX,
  INVENTORY_CATEGORY_MAX,
  INVENTORY_SUPPLIER_MAX,
  INVENTORY_NOTE_MAX,
  INVENTORY_QUANTITY_MAX,
  INVENTORY_UNIT_COST_MAX,
  INVENTORY_IMPORT_MAX_ROWS,
} from '@/config/constants';
import { expensePaymentMethodSchema } from '@/lib/schemas/expense';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format YYYY-MM-DD');

// ─── Unités ─────────────────────────────────────────────────────────────────

export const inventoryUnitSchema = z.enum([
  'UNIT',
  'KG',
  'G',
  'L',
  'ML',
  'BOX',
]);

export type InventoryUnitInput = z.infer<typeof inventoryUnitSchema>;

const quantity = z
  .number()
  .nonnegative('Quantité invalide')
  .max(INVENTORY_QUANTITY_MAX, 'Quantité trop élevée');

const unitCost = z
  .number()
  .int('Coût entier (FCFA)')
  .nonnegative('Coût invalide')
  .max(INVENTORY_UNIT_COST_MAX, 'Coût trop élevé');

// ─── Références (articles) ────────────────────────────────────────────────────

// Champs « métier » d'un article, hors quantité/PMP (gérés via mouvements).
// Exporté pour `.extend({ id })` côté MCP.
export const inventoryItemObjectSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'Référence (SKU) requise')
    .max(INVENTORY_SKU_MAX, 'Référence trop longue'),
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(INVENTORY_NAME_MAX, 'Nom trop long'),
  unit: inventoryUnitSchema.optional(),
  category: z
    .string()
    .trim()
    .max(INVENTORY_CATEGORY_MAX, 'Catégorie trop longue')
    .nullable()
    .optional(),
  safetyStock: quantity.optional(),
  reorderPoint: quantity.nullable().optional(),
  supplier: z
    .string()
    .trim()
    .max(INVENTORY_SUPPLIER_MAX, 'Fournisseur trop long')
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(INVENTORY_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
  active: z.boolean().optional(),
});

// Création : on autorise un stock + coût d'ouverture optionnels.
export const inventoryItemInputSchema = inventoryItemObjectSchema.extend({
  initialQuantity: quantity.optional(),
  initialUnitCost: unitCost.optional(),
});

export type InventoryItemInput = z.infer<typeof inventoryItemInputSchema>;

// Mise à jour partielle (pas de quantité : elle passe par achats/comptages).
export const inventoryItemUpdateSchema = inventoryItemObjectSchema
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Au moins un champ à mettre à jour est requis',
  });

export type InventoryItemUpdateInput = z.infer<
  typeof inventoryItemUpdateSchema
>;

// ─── Réappro (achats par lot) ─────────────────────────────────────────────────

export const inventoryPurchaseLineSchema = z.object({
  itemId: z.string().min(1, 'Article requis'),
  quantity: z
    .number()
    .positive('Quantité requise')
    .max(INVENTORY_QUANTITY_MAX, 'Quantité trop élevée'),
  unitCost,
});

export type InventoryPurchaseLineInput = z.infer<
  typeof inventoryPurchaseLineSchema
>;

export const batchRestockSchema = z
  .object({
    date: dateOnly,
    supplier: z
      .string()
      .trim()
      .max(INVENTORY_SUPPLIER_MAX, 'Fournisseur trop long')
      .nullable()
      .optional(),
    note: z
      .string()
      .trim()
      .max(INVENTORY_NOTE_MAX, 'Note trop longue')
      .nullable()
      .optional(),
    // Crée une dépense liée du montant total (cf. module Dépenses).
    createExpense: z.boolean().optional(),
    expenseCategoryId: z.string().min(1).nullable().optional(),
    paymentMethod: expensePaymentMethodSchema.optional(),
    lines: z
      .array(inventoryPurchaseLineSchema)
      .min(1, 'Au moins une ligne de réappro'),
  })
  .refine((v) => !v.createExpense || Boolean(v.expenseCategoryId), {
    message: 'Catégorie de dépense requise pour créer une dépense liée',
    path: ['expenseCategoryId'],
  });

export type BatchRestockInput = z.infer<typeof batchRestockSchema>;

// ─── Comptage périodique ──────────────────────────────────────────────────────

export const inventoryCountLineSchema = z.object({
  itemId: z.string().min(1, 'Article requis'),
  countedQuantity: quantity,
});

export const batchCountSchema = z.object({
  date: dateOnly,
  label: z
    .string()
    .trim()
    .max(INVENTORY_NAME_MAX, 'Libellé trop long')
    .nullable()
    .optional(),
  note: z
    .string()
    .trim()
    .max(INVENTORY_NOTE_MAX, 'Note trop longue')
    .nullable()
    .optional(),
  lines: z
    .array(inventoryCountLineSchema)
    .min(1, 'Au moins une ligne de comptage'),
});

export type BatchCountInput = z.infer<typeof batchCountSchema>;

// ─── Import Excel (catalogue de références) ────────────────────────────────────
//
// Les valeurs proviennent d'un tableur : on coerce les nombres. La validation
// stricte (et l'écriture) vit dans les mutations (bulkUpsertInventoryItems).

export const inventoryImportRowSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, 'Référence (SKU) requise')
    .max(INVENTORY_SKU_MAX, 'Référence trop longue'),
  name: z
    .string()
    .trim()
    .min(1, 'Nom requis')
    .max(INVENTORY_NAME_MAX, 'Nom trop long'),
  category: z.string().trim().max(INVENTORY_CATEGORY_MAX).nullable().optional(),
  unit: inventoryUnitSchema.optional(),
  safetyStock: z.coerce
    .number()
    .nonnegative()
    .max(INVENTORY_QUANTITY_MAX)
    .optional(),
  reorderPoint: z.coerce
    .number()
    .nonnegative()
    .max(INVENTORY_QUANTITY_MAX)
    .nullable()
    .optional(),
  supplier: z.string().trim().max(INVENTORY_SUPPLIER_MAX).nullable().optional(),
  initialQuantity: z.coerce
    .number()
    .nonnegative()
    .max(INVENTORY_QUANTITY_MAX)
    .optional(),
  initialUnitCost: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(INVENTORY_UNIT_COST_MAX)
    .optional(),
});

export type InventoryImportRowInput = z.infer<typeof inventoryImportRowSchema>;

export const INVENTORY_IMPORT_MODES = [
  'references',
  'count',
  'purchases',
] as const;
export const inventoryImportModeSchema = z.enum(INVENTORY_IMPORT_MODES);
export type InventoryImportMode = z.infer<typeof inventoryImportModeSchema>;

// ─── Filtres de liste ─────────────────────────────────────────────────────────

export const inventoryFiltersSchema = z.object({
  search: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  lowStockOnly: z.boolean().optional(),
  active: z.boolean().optional(),
});

export type InventoryFiltersInput = z.infer<typeof inventoryFiltersSchema>;

// Garde-fou réutilisable : nombre max de lignes d'import.
export const INVENTORY_IMPORT_MAX_ROWS_VALUE = INVENTORY_IMPORT_MAX_ROWS;
