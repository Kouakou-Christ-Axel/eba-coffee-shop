// lib/contact-settings-db.ts
import prisma from '@/lib/prisma';
import {
  DEFAULT_CONTACT_SETTINGS,
  contactSettingsFromRow,
  contactSettingsSchema,
  type ContactSettings,
} from '@/lib/contact-settings';

export async function getContactSettings(): Promise<ContactSettings> {
  const row = await prisma.contactSettings.findUnique({
    where: { id: 'singleton' },
  });
  return contactSettingsFromRow(row);
}

export async function updateContactSettings(
  input: ContactSettings
): Promise<void> {
  const data = contactSettingsSchema.parse(input);
  await prisma.contactSettings.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton', ...data },
    update: data,
  });
}

export { DEFAULT_CONTACT_SETTINGS };
