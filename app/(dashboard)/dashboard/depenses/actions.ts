'use server';

import { revalidatePath } from 'next/cache';
import { requireFinance } from '@/lib/auth-helpers';
import * as expenses from '@/lib/expense-mutations';
import * as recurring from '@/lib/recurring-expense-mutations';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdminId(): Promise<string> {
  const session = await requireFinance();
  return session.user.id;
}

function revalidate() {
  revalidatePath('/dashboard/depenses');
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

// ── Catégories ──

export async function createExpenseCategoryAction(input: {
  name: string;
}): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.createExpenseCategory(input));
}

export async function updateExpenseCategoryAction(
  id: string,
  input: { name: string }
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.updateExpenseCategory(id, input));
}

export async function deleteExpenseCategoryAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.deleteExpenseCategory(id));
}

// ── Dépenses ──

export async function createExpenseAction(
  input: unknown
): Promise<ActionResult> {
  const userId = await requireAdminId();
  return run(() => expenses.createExpense(input, userId));
}

export async function updateExpenseAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.updateExpense(id, input));
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.deleteExpense(id));
}

/**
 * Numérote rétroactivement les dépenses sans numéro de reçu. Idempotent.
 * Renvoie le nombre de dépenses numérotées pour le retour visuel.
 */
export async function backfillExpenseReceiptsAction(): Promise<
  { ok: true; updated: number; total: number } | { ok: false; error: string }
> {
  await requireAdminId();
  try {
    const res = await expenses.backfillExpenseReceipts();
    revalidate();
    return { ok: true, ...res };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inattendue',
    };
  }
}

// ── Dépenses récurrentes (modèles) ──

export async function createRecurringExpenseAction(
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => recurring.createRecurringExpense(input));
}

export async function updateRecurringExpenseAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => recurring.updateRecurringExpense(id, input));
}

export async function deleteRecurringExpenseAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => recurring.deleteRecurringExpense(id));
}
