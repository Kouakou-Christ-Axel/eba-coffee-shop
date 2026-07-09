// app/(dashboard)/dashboard/menu/actions.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

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
}));

import { ZodError } from 'zod';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
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
} from './actions';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockRevalidate = revalidatePath as MockedFunction<typeof revalidatePath>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci', name: null },
  session: {},
} as never;

describe('Menu Server Actions — auth gate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('createCategoryAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(createCategoryAction({ name: 'X' })).rejects.toThrow(
      'Non autorisé'
    );
    expect(mutations.createCategory).not.toHaveBeenCalled();
  });

  it('createCategoryAction avec session USER → throw', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);
    await expect(createCategoryAction({ name: 'X' })).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('toggleCategoryAvailabilityAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(toggleCategoryAvailabilityAction('cat1')).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('createProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      createProductAction({
        categoryId: 'c',
        name: 'X',
        description: 'd',
        price: 100,
        imageUrl: null,
        supplementGroups: [],
      })
    ).rejects.toThrow('Non autorisé');
  });

  it('restockProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(restockProductAction('p1', 5)).rejects.toThrow('Non autorisé');
    expect(mutations.restockProduct).not.toHaveBeenCalled();
  });

  it('pauseProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await expect(pauseProductAction('p1', until)).rejects.toThrow(
      'Non autorisé'
    );
    expect(mutations.pauseProduct).not.toHaveBeenCalled();
  });

  it('resumeProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(resumeProductAction('p1')).rejects.toThrow('Non autorisé');
    expect(mutations.resumeProduct).not.toHaveBeenCalled();
  });
});

describe('Menu Server Actions — happy path + revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue(adminSession);
  });

  it('createCategoryAction appelle mutation puis revalide /api/menu et /carte', async () => {
    await createCategoryAction({ name: 'Pâtisseries' });
    expect(mutations.createCategory).toHaveBeenCalledWith({
      name: 'Pâtisseries',
    });
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
    expect(mockRevalidate).toHaveBeenCalledWith('/carte');
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

    expect(result).toEqual({ error: 'Produit introuvable' });
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

  it('restockProductAction delta non entier → throw sans appeler la mutation', async () => {
    await expect(restockProductAction('p1', 1.5)).rejects.toThrow(
      'Quantité invalide'
    );
    expect(mutations.restockProduct).not.toHaveBeenCalled();
  });

  it('restockProductAction delta nul → throw sans appeler la mutation', async () => {
    await expect(restockProductAction('p1', 0)).rejects.toThrow(
      'Quantité invalide'
    );
    expect(mutations.restockProduct).not.toHaveBeenCalled();
  });

  it('pauseProductAction → mutation + revalidate', async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await pauseProductAction('p1', until);
    expect(mutations.pauseProduct).toHaveBeenCalledWith('p1', new Date(until));
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });

  it('pauseProductAction date passée → throw sans appeler la mutation', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await expect(pauseProductAction('p1', past)).rejects.toThrow(
      'Date de reprise invalide (doit être dans le futur)'
    );
    expect(mutations.pauseProduct).not.toHaveBeenCalled();
  });

  it('pauseProductAction date invalide → throw sans appeler la mutation', async () => {
    await expect(pauseProductAction('p1', 'pas-une-date')).rejects.toThrow(
      'Date de reprise invalide (doit être dans le futur)'
    );
    expect(mutations.pauseProduct).not.toHaveBeenCalled();
  });

  it('resumeProductAction → mutation + revalidate', async () => {
    await resumeProductAction('p1');
    expect(mutations.resumeProduct).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });
});
