'use server';

import { revalidatePath } from 'next/cache';
import { requireFinance } from '@/lib/auth-helpers';
import * as expenses from '@/lib/expense-mutations';
import * as recurring from '@/lib/recurring-expense-mutations';
import { updateExpenseSettings } from '@/lib/expense-settings-db';

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
  nature?: 'FIXED' | 'VARIABLE';
}): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.createExpenseCategory(input));
}

export async function updateExpenseCategoryAction(
  id: string,
  input: { name?: string; nature?: 'FIXED' | 'VARIABLE' }
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

// ── Référentiel d'articles (détail des lignes de dépense) ──

export async function renameExpenseArticleAction(
  id: string,
  input: { name: string }
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.renameExpenseArticle(id, input));
}

/** Soft delete : retire l'article des sélecteurs/de l'auto-complétion sans
 * toucher aux lignes de dépense existantes. */
export async function archiveExpenseArticleAction(
  id: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.archiveExpenseArticle(id));
}

/** Réglages d'un article (unité de base, suivi de stock, emplacement, prix de
 * référence en gros). Mise à jour partielle. */
export async function setExpenseArticleSettingsAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.setExpenseArticleSettings(id, input));
}

/**
 * Fusionne deux articles en double : `sourceId` est absorbé par `targetId`
 * (toutes ses lignes de dépense et alias sont re-rattachés, puis il est
 * archivé). Jamais l'inverse.
 */
export async function mergeArticlesAction(
  sourceId: string,
  targetId: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.mergeArticles(sourceId, targetId));
}

/**
 * Re-rattache une ligne de dépense (`ExpenseItem`) à un autre article —
 * correction d'un rapprochement erroné ou absent. Apprend l'alias
 * correspondant pour la prochaine saisie.
 */
export async function relinkExpenseItemAction(
  itemId: string,
  articleId: string
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => expenses.relinkExpenseItem(itemId, articleId));
}

// ── Réglages globaux (seuils fréquence/cumul/prix aberrant, TTL brouillon) ──

export async function updateExpenseSettingsAction(
  input: unknown
): Promise<ActionResult> {
  await requireAdminId();
  return run(() => updateExpenseSettings(input));
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
