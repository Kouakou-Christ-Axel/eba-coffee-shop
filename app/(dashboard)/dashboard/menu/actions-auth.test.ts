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

import * as mutations from '@/lib/menu-mutations';
import {
  createCategoryAction,
  toggleCategoryAvailabilityAction,
  createProductAction,
  restockProductAction,
  pauseProductAction,
  resumeProductAction,
  moveProductAction,
  reorderCategoriesAction,
  reorderProductsAction,
} from './actions';
import { mockGetSession } from './actions.test-utils';

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

describe('Menu Server Actions — garde d’autorisation des nouvelles actions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('reorderProductsAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(reorderProductsAction('cat1', ['p1'])).rejects.toThrow(
      'Non autorisé'
    );
    expect(mutations.reorderProducts).not.toHaveBeenCalled();
  });

  it('reorderCategoriesAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(reorderCategoriesAction(['c1'])).rejects.toThrow(
      'Non autorisé'
    );
    expect(mutations.reorderCategories).not.toHaveBeenCalled();
  });

  it('moveProductAction sans session → throw', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(moveProductAction('p1', 'up')).rejects.toThrow('Non autorisé');
    expect(mutations.moveProduct).not.toHaveBeenCalled();
  });
});
