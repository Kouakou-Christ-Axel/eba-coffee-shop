// lib/loyalty-settings-db.ts
import prisma from '@/lib/prisma';
import {
  DEFAULT_LOYALTY_SETTINGS,
  loyaltySettingsFromRow,
  loyaltySettingsSchema,
  type LoyaltySettings,
} from '@/lib/loyalty-settings';

export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  const row = await prisma.loyaltySettings.findUnique({
    where: { id: 'singleton' },
  });
  return loyaltySettingsFromRow(row);
}

export async function updateLoyaltySettings(
  input: LoyaltySettings
): Promise<void> {
  const data = loyaltySettingsSchema.parse(input);
  await prisma.loyaltySettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
}

export { DEFAULT_LOYALTY_SETTINGS };
