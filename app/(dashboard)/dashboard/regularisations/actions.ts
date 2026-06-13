'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import * as adjustments from '@/lib/revenue-adjustment-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
  return session.user.id;
}

function revalidate() {
  revalidatePath('/dashboard/regularisations');
  revalidatePath('/dashboard/statistiques');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/cloture');
}

/** Exécute une mutation admin et renvoie un résultat sérialisable. */
async function run(fn: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await fn();
    revalidate();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

export async function createRevenueAdjustmentAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(() => adjustments.createRevenueAdjustment(input, userId));
}

export async function updateRevenueAdjustmentAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => adjustments.updateRevenueAdjustment(id, input));
}

export async function deleteRevenueAdjustmentAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => adjustments.deleteRevenueAdjustment(id));
}
