'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireManager } from '@/lib/auth-helpers';
import * as menu from '@/lib/menu-mutations';
import type { ProductInput, ProductUpdate } from '@/lib/menu-mutations';

// Next.js redacte en production le message de toute erreur qui *traverse*
// une Server Action (générique « An error occurred in the Server
// Components render… », quel que soit le type d'erreur) : un throw ne suffit
// pas à faire remonter un message utile à l'admin. Une erreur de validation
// (ex. deux options du même nom dans un groupe) est un cas ATTENDU, pas une
// panne — on l'attrape ici et on la RENVOIE (valeur normale, non redactée)
// plutôt que de la laisser remonter comme exception.
function formatMutationError(err: unknown): string {
  if (err instanceof ZodError) {
    return [...new Set(err.issues.map((i) => i.message))].join(' ');
  }
  return err instanceof Error ? err.message : 'Erreur inattendue';
}

function revalidateMenu() {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
  revalidatePath('/');
}

// ── Catégories ──

export async function createCategoryAction(input: { name: string }) {
  await requireManager();
  await menu.createCategory(input);
  revalidateMenu();
}

export async function updateCategoryAction(
  id: string,
  input: { name: string }
) {
  await requireManager();
  await menu.updateCategory(id, input);
  revalidateMenu();
}

export async function deleteCategoryAction(id: string) {
  await requireManager();
  await menu.deleteCategory(id);
  revalidateMenu();
}

export async function toggleCategoryAvailabilityAction(id: string) {
  await requireManager();
  await menu.toggleCategoryAvailability(id);
  revalidateMenu();
}

export async function moveCategoryAction(id: string, direction: 'up' | 'down') {
  await requireManager();
  await menu.moveCategory(id, direction);
  revalidateMenu();
}

// ── Produits ──

export async function createProductAction(
  input: ProductInput
): Promise<{ error: string } | undefined> {
  await requireManager();
  try {
    await menu.createProduct(input);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateMenu();
}

export async function updateProductAction(
  id: string,
  input: ProductUpdate
): Promise<{ error: string } | undefined> {
  await requireManager();
  try {
    await menu.updateProduct(id, input);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateMenu();
}

export async function deleteProductAction(id: string) {
  await requireManager();
  await menu.deleteProduct(id);
  revalidateMenu();
}

export async function toggleProductAvailabilityAction(id: string) {
  await requireManager();
  await menu.toggleProductAvailability(id);
  revalidateMenu();
}

export async function toggleProductFeaturedAction(id: string) {
  await requireManager();
  await menu.toggleProductFeatured(id);
  revalidateMenu();
}

// ── Stock & pause ──

export async function restockProductAction(id: string, delta: number) {
  await requireManager();
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Quantité invalide');
  }
  await menu.restockProduct(id, delta);
  revalidateMenu();
}

export async function pauseProductAction(id: string, until: string) {
  await requireManager();
  const untilDate = new Date(until);
  if (Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
    throw new Error('Date de reprise invalide (doit être dans le futur)');
  }
  await menu.pauseProduct(id, untilDate);
  revalidateMenu();
}

export async function resumeProductAction(id: string) {
  await requireManager();
  await menu.resumeProduct(id);
  revalidateMenu();
}
