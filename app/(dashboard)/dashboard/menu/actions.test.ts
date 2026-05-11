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
}));

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import * as mutations from '@/lib/menu-mutations';
import {
  createCategoryAction,
  toggleCategoryAvailabilityAction,
  deleteCategoryAction,
  createProductAction,
  toggleProductAvailabilityAction,
  deleteProductAction,
} from './actions';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockRevalidate = revalidatePath as MockedFunction<typeof revalidatePath>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
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

  it('deleteProductAction → mutation + revalidate', async () => {
    await deleteProductAction('p1');
    expect(mutations.deleteProduct).toHaveBeenCalledWith('p1');
    expect(mockRevalidate).toHaveBeenCalledWith('/api/menu');
  });
});
