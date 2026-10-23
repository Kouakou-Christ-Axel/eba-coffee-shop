// lib/credit-settings-db.ts
import prisma from '@/lib/prisma';
import {
  DEFAULT_CREDIT_SETTINGS,
  creditSettingsFromRow,
  creditSettingsSchema,
  type CreditSettings,
} from '@/lib/credit-settings';

export async function getCreditSettings(): Promise<CreditSettings> {
  const row = await prisma.creditSettings.findUnique({
    where: { id: 'singleton' },
  });
  return creditSettingsFromRow(row);
}

export async function updateCreditSettings(
  input: CreditSettings
): Promise<void> {
  const data = creditSettingsSchema.parse(input);
  await prisma.creditSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
}

export { DEFAULT_CREDIT_SETTINGS };
