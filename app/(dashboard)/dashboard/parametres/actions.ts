'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import {
  pickupSettingsSchema,
  type PickupSettings,
} from '@/lib/pickup-settings';
import { updatePickupSettings } from '@/lib/pickup-settings-db';
import {
  loyaltySettingsSchema,
  type LoyaltySettings,
} from '@/lib/loyalty-settings';
import { updateLoyaltySettings } from '@/lib/loyalty-settings-db';

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
}

export async function savePickupSettings(
  input: PickupSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = pickupSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
  }
  await updatePickupSettings(parsed.data);
  revalidatePath('/dashboard/parametres');
  revalidatePath('/carte');
  return { ok: true };
}

export async function saveLoyaltySettings(
  input: LoyaltySettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = loyaltySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
    };
  }
  await updateLoyaltySettings(parsed.data);
  revalidatePath('/dashboard/parametres');
  return { ok: true };
}
