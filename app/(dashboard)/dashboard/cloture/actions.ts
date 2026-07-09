'use server';

import { revalidatePath } from 'next/cache';
import { requireCloture, requireManager } from '@/lib/auth-helpers';
import * as cash from '@/lib/cash-closing-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath('/dashboard/cloture');
}

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

export async function saveCashClosingAction(
  input: unknown
): Promise<ActionResult> {
  const session = await requireCloture();
  return run(() => cash.saveCashClosing(input, session.user.id));
}

export async function deleteCashClosingAction(
  id: string
): Promise<ActionResult> {
  await requireManager();
  return run(() => cash.deleteCashClosing(id));
}
