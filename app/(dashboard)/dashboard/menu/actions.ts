'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import * as menu from '@/lib/menu-mutations';
import type { ProductInput, ProductUpdate } from '@/lib/menu-mutations';

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
}

function revalidateMenu() {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
  revalidatePath('/');
}

// ── Catégories ──

export async function createCategoryAction(input: { name: string }) {
  await requireAdmin();
  await menu.createCategory(input);
  revalidateMenu();
}

export async function updateCategoryAction(
  id: string,
  input: { name: string }
) {
  await requireAdmin();
  await menu.updateCategory(id, input);
  revalidateMenu();
}

export async function deleteCategoryAction(id: string) {
  await requireAdmin();
  await menu.deleteCategory(id);
  revalidateMenu();
}

export async function toggleCategoryAvailabilityAction(id: string) {
  await requireAdmin();
  await menu.toggleCategoryAvailability(id);
  revalidateMenu();
}

export async function moveCategoryAction(id: string, direction: 'up' | 'down') {
  await requireAdmin();
  await menu.moveCategory(id, direction);
  revalidateMenu();
}

// ── Produits ──

export async function createProductAction(input: ProductInput) {
  await requireAdmin();
  await menu.createProduct(input);
  revalidateMenu();
}

export async function updateProductAction(id: string, input: ProductUpdate) {
  await requireAdmin();
  await menu.updateProduct(id, input);
  revalidateMenu();
}

export async function deleteProductAction(id: string) {
  await requireAdmin();
  await menu.deleteProduct(id);
  revalidateMenu();
}

export async function toggleProductAvailabilityAction(id: string) {
  await requireAdmin();
  await menu.toggleProductAvailability(id);
  revalidateMenu();
}

export async function toggleProductFeaturedAction(id: string) {
  await requireAdmin();
  await menu.toggleProductFeatured(id);
  revalidateMenu();
}

// ── Stock & pause ──

export async function restockProductAction(id: string, delta: number) {
  await requireAdmin();
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Quantité invalide');
  }
  await menu.restockProduct(id, delta);
  revalidateMenu();
}

export async function pauseProductAction(id: string, until: string) {
  await requireAdmin();
  const untilDate = new Date(until);
  if (Number.isNaN(untilDate.getTime()) || untilDate.getTime() <= Date.now()) {
    throw new Error('Date de reprise invalide (doit être dans le futur)');
  }
  await menu.pauseProduct(id, untilDate);
  revalidateMenu();
}

export async function resumeProductAction(id: string) {
  await requireAdmin();
  await menu.resumeProduct(id);
  revalidateMenu();
}
