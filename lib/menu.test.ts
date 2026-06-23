// lib/menu.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    menuCategory: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { getMenu } from './menu';

const mockFindMany = prisma.menuCategory.findMany as MockedFunction<
  typeof prisma.menuCategory.findMany
>;

const mockDbData = [
  {
    id: 'cat1',
    name: 'Boissons chaudes',
    slug: 'boissons-chaudes',
    sortOrder: 0,
    available: true,
    products: [
      {
        id: 'prod1',
        name: 'Espresso',
        description: 'Court et intense',
        price: 1500,
        imageUrl: null,
        available: true,
        sortOrder: 0,
        categoryId: 'cat1',
        supplementGroups: [
          {
            id: 'grp1',
            name: 'Extras',
            type: 'multiple',
            required: false,
            sortOrder: 0,
            productId: 'prod1',
            options: [
              {
                id: 'opt1',
                name: 'Shot espresso',
                price: 300,
                groupId: 'grp1',
              },
            ],
          },
        ],
      },
    ],
  },
];

describe('getMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('retourne les catégories avec leurs produits et suppléments', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Boissons chaudes');
    expect(result[0].products).toHaveLength(1);
    expect(result[0].products[0].name).toBe('Espresso');
  });

  it('mappe imageUrl vers image', async () => {
    const dataWithImage = [
      {
        ...mockDbData[0],
        products: [
          {
            ...mockDbData[0].products[0],
            imageUrl: 'https://blob.vercel.com/img.jpg',
          },
        ],
      },
    ];
    mockFindMany.mockResolvedValue(dataWithImage as never);
    const result = await getMenu();
    expect(result[0].products[0].image).toBe('https://blob.vercel.com/img.jpg');
  });

  it('imageUrl null → image undefined', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result[0].products[0].image).toBeUndefined();
  });

  it('mappe les groupes de suppléments avec leurs options', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    const sups = result[0].products[0].supplements;
    expect(sups).toHaveLength(1);
    expect(sups![0].name).toBe('Extras');
    expect(sups![0].type).toBe('multiple');
    expect(sups![0].options[0].name).toBe('Shot espresso');
    expect(sups![0].options[0].price).toBe(300);
  });

  it('utilise le slug de catégorie comme id (pour les ancres HTML)', async () => {
    mockFindMany.mockResolvedValue(mockDbData as never);
    const result = await getMenu();
    expect(result[0].id).toBe('boissons-chaudes');
  });

  it('filtre les catégories available:false et supprimées', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { available: true, deletedAt: null } })
    );
  });

  it('filtre les produits available:false et supprimés', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          products: expect.objectContaining({
            where: { available: true, deletedAt: null },
          }),
        }),
      })
    );
  });

  it('trie les catégories par sortOrder ASC', async () => {
    mockFindMany.mockResolvedValue([]);
    await getMenu();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sortOrder: 'asc' } })
    );
  });
});
