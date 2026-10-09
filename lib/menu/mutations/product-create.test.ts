import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('./test-mocks')).prismaModuleMock()
);
vi.mock('@/lib/restock-alerts', () => ({ triggerRestockAlerts: vi.fn() }));

import { createProduct } from '@/lib/menu-mutations';
import { mockProdCreate, mockProdFindMany } from './test-utils';

describe('createProduct', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockProdFindMany.mockResolvedValue([] as never);
  });

  it('crée un produit avec ses groupes de suppléments', async () => {
    mockProdCreate.mockResolvedValue({ id: 'p1' } as never);

    await createProduct({
      categoryId: 'cat1',
      name: 'Latte',
      description: 'Doux',
      price: 3500,
      imageUrl: 'https://blob.vercel.com/x.jpg',
      supplementGroups: [
        {
          name: 'Lait',
          type: 'single',
          required: false,
          options: [
            { name: 'Avoine', price: 500 },
            { name: 'Amande', price: 500 },
          ],
        },
      ],
    });

    expect(mockProdCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 'cat1',
        name: 'Latte',
        description: 'Doux',
        price: 3500,
        imageUrl: 'https://blob.vercel.com/x.jpg',
        sortOrder: expect.any(Number),
        supplementGroups: {
          create: [
            expect.objectContaining({
              name: 'Lait',
              type: 'single',
              required: false,
              sortOrder: 0,
              options: {
                create: [
                  {
                    name: 'Avoine',
                    price: 500,
                    available: true,
                    stockQuantity: null,
                    sortOrder: 0,
                  },
                  {
                    name: 'Amande',
                    price: 500,
                    available: true,
                    stockQuantity: null,
                    sortOrder: 1,
                  },
                ],
              },
            }),
          ],
        },
      }),
    });
  });

  it('rejette si nom vide', async () => {
    await expect(
      createProduct({
        categoryId: 'cat1',
        name: '',
        description: 'd',
        price: 100,
        supplementGroups: [],
      })
    ).rejects.toThrow();
  });

  it('rejette si prix négatif', async () => {
    await expect(
      createProduct({
        categoryId: 'cat1',
        name: 'X',
        description: 'd',
        price: -10,
        supplementGroups: [],
      })
    ).rejects.toThrow();
  });
});
