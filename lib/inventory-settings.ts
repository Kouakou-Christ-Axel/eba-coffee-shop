// lib/inventory-settings.ts
//
// Schéma Zod + défauts des réglages d'inventaire (rappel email si aucun comptage
// depuis N jours). Mappage d'une ligne DB → config effective. Persistance dans
// lib/inventory-settings-db.ts (singleton, calque de la fidélité).

import { z } from 'zod';

export const inventorySettingsSchema = z.object({
  reminderEnabled: z.boolean(),
  reminderDays: z.number().int().min(1).max(365),
});

export type InventorySettings = z.infer<typeof inventorySettingsSchema>;

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  reminderEnabled: true,
  reminderDays: 7,
};

/** Ligne DB partielle → config effective (défauts si champ manquant/null). */
export function inventorySettingsFromRow(
  row: Partial<InventorySettings> | null | undefined
): InventorySettings {
  return { ...DEFAULT_INVENTORY_SETTINGS, ...(row ?? {}) };
}
