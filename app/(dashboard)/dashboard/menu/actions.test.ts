import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@/lib/menu-mutations', () => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  toggleCategoryAvailability: vi.fn(),
  moveCategory: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  toggleProductAvailability: vi.fn(),
  restockProduct: vi.fn(),
  pauseProduct: vi.fn(),
  resumeProduct: vi.fn(),
  moveProduct: vi.fn(),
  reorderCategories: vi.fn(),
  reorderProducts: vi.fn(),
}));

import { ZodError } from 'zod';
import * as mutations from '@/lib/menu-mutations';
import {
  createCategoryAction,
  toggleCategoryAvailabilityAction,
  deleteCategoryAction,
  createProductAction,
  updateProductAction,
  toggleProductAvailabilityAction,
  deleteProductAction,
  restockProductAction,
  pauseProductAction,
  resumeProductAction,
  moveProductAction,
  reorderCategoriesAction,
  reorderProductsAction,
} from './actions';
import {
  mockGetSession,
  mockRevalidate,
  mockCreateCategory,
  adminSession,
} from './actions.test-utils';

describe('Menu Server Actions — happy path + revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(adminSession);
  });

  it('createCategoryAction appelle mutation puis revalide /api/menu et /carte', async () => {
    mockCreateCategory.mockResolvedValue({
      id: 'cat9',
      name: 'Pâtisseries',
    } as never);
    await createCategoryAction({ name: 'Pâtisseries' });
    expect(mutations.createCategory).toHaveBeenCalledWith({
      name: 'Pâtisseries',
    });
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
    expect(mockRevalidate).toHaveBeenCalledWith('/carte');
  });

  // Le panneau « Nouveau produit » enchaîne sur la fiche produit de la
  // catégorie qu'il vient de créer : sans cet id, il faudrait renvoyer la
  // personne sur la liste pour qu'elle y retourne à la main.
  it('createCategoryAction renvoie l’id et le nom de la catégorie créée', async () => {
    mockCreateCategory.mockResolvedValue({
      id: 'cat9',
      name: 'Pâtisseries',
      slug: 'patisseries',
      sortOrder: 3,
    } as never);
    const result = await createCategoryAction({ name: 'Pâtisseries' });
    expect(result).toEqual({
      ok: true,
      data: { id: 'cat9', name: 'Pâtisseries' },
    });
  });

  it('toggleCategoryAvailabilityAction → mutation + revalidate', async () => {
    await toggleCategoryAvailabilityAction('cat1');
    expect(mutations.toggleCategoryAvailability).toHaveBeenCalledWith('cat1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('deleteCategoryAction → mutation + revalidate', async () => {
    await deleteCategoryAction('cat1');
    expect(mutations.deleteCategory).toHaveBeenCalledWith('cat1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('createProductAction → mutation + revalidate', async () => {
    const input = {
      categoryId: 'cat1',
      name: 'Latte',
      description: 'd',
      price: 3500,
      imageUrl: 'https://blob.vercel.com/x.jpg',
      supplementGroups: [],
    };
    await createProductAction(input);
    expect(mutations.createProduct).toHaveBeenCalledWith(input);
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('toggleProductAvailabilityAction → mutation + revalidate', async () => {
    await toggleProductAvailabilityAction('p1');
    expect(mutations.toggleProductAvailability).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  // Régression : une erreur de validation (ex. deux options du même nom dans
  // un groupe) est un cas ATTENDU — l'action doit la RENVOYER (pas la laisser
  // remonter comme exception), car Next.js redacte en production le message
  // de toute erreur qui traverse une Server Action, la rendant illisible pour
  // l'admin (cf. formatMutationError, actions.ts).
  it('updateProductAction : une erreur de validation est renvoyée, pas jetée', async () => {
    const zodError = new ZodError([
      {
        code: 'custom',
        message:
          'Deux options ne peuvent pas porter le même nom dans un groupe',
        path: ['supplementGroups', 0, 'options'],
      },
    ]);
    (
      mutations.updateProduct as MockedFunction<typeof mutations.updateProduct>
    ).mockRejectedValueOnce(zodError);

    const result = await updateProductAction('p1', {
      name: 'Tartelettes x3',
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Deux options ne peuvent pas porter le même nom dans un groupe',
    });
    // Pas de revalidation sur un échec de validation.
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('createProductAction : une erreur non-Zod est renvoyée avec son message', async () => {
    (
      mutations.createProduct as MockedFunction<typeof mutations.createProduct>
    ).mockRejectedValueOnce(new Error('Produit introuvable'));

    const result = await createProductAction({
      categoryId: 'cat1',
      name: 'X',
      description: 'd',
      price: 100,
      imageUrl: null,
      supplementGroups: [],
    });

    expect(result).toEqual({ ok: false, error: 'Produit introuvable' });
  });

  it('deleteProductAction → mutation + revalidate', async () => {
    await deleteProductAction('p1');
    expect(mutations.deleteProduct).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('restockProductAction → mutation + revalidate', async () => {
    await restockProductAction('p1', 6);
    expect(mutations.restockProduct).toHaveBeenCalledWith('p1', 6);
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  // Une saisie invalide est un cas ATTENDU : l'action la RENVOIE (message
  // lisible côté admin, non redacté en production) au lieu de la jeter.
  it('restockProductAction delta non entier → erreur renvoyée sans appeler la mutation', async () => {
    await expect(restockProductAction('p1', 1.5)).resolves.toEqual({
      ok: false,
      error: 'Quantité invalide',
    });
    expect(mutations.restockProduct).not.toHaveBeenCalled();
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it('restockProductAction delta nul → erreur renvoyée sans appeler la mutation', async () => {
    await expect(restockProductAction('p1', 0)).resolves.toEqual({
      ok: false,
      error: 'Quantité invalide',
    });
    expect(mutations.restockProduct).not.toHaveBeenCalled();
  });

  it('pauseProductAction → mutation + revalidate', async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pauseProductAction('p1', until);
    expect(mutations.pauseProduct).toHaveBeenCalledWith('p1', new Date(until));
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('pauseProductAction date passée → erreur renvoyée sans appeler la mutation', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await expect(pauseProductAction('p1', past)).resolves.toEqual({
      ok: false,
      error: 'Date de reprise invalide (doit être dans le futur)',
    });
    expect(mutations.pauseProduct).not.toHaveBeenCalled();
  });

  it('pauseProductAction date invalide → erreur renvoyée sans appeler la mutation', async () => {
    await expect(pauseProductAction('p1', 'pas-une-date')).resolves.toEqual({
      ok: false,
      error: 'Date de reprise invalide (doit être dans le futur)',
    });
    expect(mutations.pauseProduct).not.toHaveBeenCalled();
  });

  it('resumeProductAction → mutation + revalidate', async () => {
    await resumeProductAction('p1');
    expect(mutations.resumeProduct).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  // Le dashboard doit être revalidé au même titre que les pages publiques :
  // une mutation faite depuis `[categoryId]` change le compteur de produits
  // affiché sur la liste des catégories.
  it('revalideMenu couvre aussi la section dashboard', async () => {
    await toggleProductAvailabilityAction('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/dashboard/menu', 'layout');
  });

  it('moveProductAction → mutation + revalidate', async () => {
    await expect(moveProductAction('p1', 'up')).resolves.toEqual({ ok: true });
    expect(mutations.moveProduct).toHaveBeenCalledWith('p1', 'up');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('reorderCategoriesAction transmet la liste ordonnée', async () => {
    await expect(reorderCategoriesAction(['c2', 'c1'])).resolves.toEqual({
      ok: true,
    });
    expect(mutations.reorderCategories).toHaveBeenCalledWith(['c2', 'c1']);
  });

  it('reorderProductsAction transmet la catégorie et la liste ordonnée', async () => {
    await expect(reorderProductsAction('cat1', ['p2', 'p1'])).resolves.toEqual({
      ok: true,
    });
    expect(mutations.reorderProducts).toHaveBeenCalledWith('cat1', [
      'p2',
      'p1',
    ]);
  });

  // Un ordre périmé (une ligne créée/supprimée entre le rendu et le dépôt)
  // doit remonter comme erreur affichable, pas comme exception redactée.
  it('reorderProductsAction : un ordre périmé est renvoyé en erreur', async () => {
    (
      mutations.reorderProducts as MockedFunction<
        typeof mutations.reorderProducts
      >
    ).mockRejectedValueOnce(new Error('La liste des produits a changé'));

    await expect(reorderProductsAction('cat1', ['p1'])).resolves.toEqual({
      ok: false,
      error: 'La liste des produits a changé',
    });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });
});
