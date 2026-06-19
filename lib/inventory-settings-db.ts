// lib/inventory-settings-db.ts
import prisma from '@/lib/prisma';
import {
  DEFAULT_INVENTORY_SETTINGS,
  inventorySettingsFromRow,
  inventorySettingsSchema,
  type InventorySettings,
} from '@/lib/inventory-settings';

export async function getInventorySettings(): Promise<InventorySettings> {
  const row = await prisma.inventorySettings.findUnique({
    where: { id: 'singleton' },
  });
  return inventorySettingsFromRow(row);
}

export async function updateInventorySettings(
  input: unknown
): Promise<InventorySettings> {
  const data = inventorySettingsSchema.parse(input);
  const row = await prisma.inventorySettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
  return inventorySettingsFromRow(row);
}

export { DEFAULT_INVENTORY_SETTINGS };
