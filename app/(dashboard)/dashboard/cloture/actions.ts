'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import * as cash from '@/lib/cash-closing-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

const CASHIER_ROLES = ['ADMIN', 'CASHIER'] as const;

async function requireCashierId(): Promise<string> {
  const session = await getCurrentSession();
  if (
    !session ||
    !(CASHIER_ROLES as readonly string[]).includes(session.user.role)
  ) {
    throw new Error('Non autorisé');
  }
  return session.user.id;
}

async function requireAdmin(): Promise<void> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
}

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
  const userId = await requireCashierId();
  return run(() => cash.saveCashClosing(input, userId));
}

export async function deleteCashClosingAction(
  id: string
): Promise<ActionResult> {
  await requireAdmin();
  return run(() => cash.deleteCashClosing(id));
}
