'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentSession } from '@/lib/auth-helpers';
import * as investments from '@/lib/investment-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
  return session.user.id;
}

function revalidate() {
  revalidatePath('/dashboard/investissements');
  revalidatePath('/dashboard/statistiques');
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

// ── Sources de financement ──

export async function createInvestmentSourceAction(input: {
  name: string;
}): Promise<ActionResult> {
  await requireAdminId();
  return run(() => investments.createInvestmentSource(input));
}

export async function updateInvestmentSourceAction(
  id: string,
  input: { name: string }
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => investments.updateInvestmentSource(id, input));
}

export async function deleteInvestmentSourceAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => investments.deleteInvestmentSource(id));
}

// ── Apports ──

export async function createInvestmentAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(() => investments.createInvestment(input, userId));
}

export async function updateInvestmentAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => investments.updateInvestment(id, input));
}

export async function deleteInvestmentAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => investments.deleteInvestment(id));
}
