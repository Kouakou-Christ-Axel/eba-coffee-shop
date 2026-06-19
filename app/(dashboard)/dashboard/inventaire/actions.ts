'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import * as inventory from '@/lib/inventory-mutations';
import { updateInventorySettings } from '@/lib/inventory-settings-db';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireStaffId(): Promise<string> {
  const session = await getCurrentSession();
  if (
    !session ||
    !['ADMIN', 'CASHIER', 'KITCHEN'].includes(session.user.role)
  ) {
    throw new Error('Non autorisé');
  }
  return session.user.id;
}

function revalidate() {
  revalidatePath('/dashboard/inventaire');
  revalidatePath('/dashboard/depenses');
  revalidatePath('/dashboard/statistiques');
}

/** Exécute une mutation et renvoie un résultat sérialisable. */
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

// ── Articles ──

export async function createInventoryItemAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireStaffId();
  return run(() => inventory.createInventoryItem(input, userId));
}

export async function updateInventoryItemAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireStaffId();
  return run(() => inventory.updateInventoryItem(id, input));
}

export async function archiveInventoryItemAction(
  id: string
): Promise<ActionResult> {
  await requireStaffId();
  return run(() => inventory.archiveInventoryItem(id));
}

export async function restoreInventoryItemAction(
  id: string
): Promise<ActionResult> {
  await requireStaffId();
  return run(() => inventory.restoreInventoryItem(id));
}

// ── Réapprovisionnement ──

export async function batchRestockAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireStaffId();
  return run(() => inventory.batchRestock(input, userId));
}

export async function cancelRestockBatchAction(
  batchId: string
): Promise<ActionResult> {
  await requireStaffId();
  return run(() => inventory.cancelRestockBatch(batchId));
}

// ── Inventaire physique ──

export async function recordInventoryCountAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireStaffId();
  return run(() => inventory.recordInventoryCount(input, userId));
}

// ── Réglages ──

export async function updateInventorySettingsAction(
  input: unknown
): Promise<ActionResult> {
  await requireStaffId();
  return run(() => updateInventorySettings(input));
}
