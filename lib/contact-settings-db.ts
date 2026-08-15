// lib/contact-settings-db.ts
import { cache } from 'react';
import prisma from '@/lib/prisma';
import {
  DEFAULT_CONTACT_SETTINGS,
  contactSettingsFromRow,
  contactSettingsSchema,
  type ContactSettings,
} from '@/lib/contact-settings';

/**
 * Coordonnées publiques du commerce.
 *
 * Mémoïsé PAR REQUÊTE (`cache()` de React) : la même page les demande à
 * plusieurs étages indépendants — `app/layout.tsx` (JSON-LD), le layout public
 * (pied de page), puis la page elle-même (`/`, `/contact`, `/le-lieu`…). Sans
 * mémoïsation, c'est trois allers-retours PostgreSQL identiques par affichage,
 * payés sur le temps de réponse serveur. Le cache ne survit pas à la requête :
 * une écriture (`updateContactSettings` + `revalidatePath`) reste visible dès
 * le rendu suivant.
 */
export const getContactSettings = cache(async (): Promise<ContactSettings> => {
  const row = await prisma.contactSettings.findUnique({
    where: { id: 'singleton' },
  });
  return contactSettingsFromRow(row);
});

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
