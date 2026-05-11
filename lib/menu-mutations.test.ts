// lib/menu-mutations.test.ts
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
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    supplementGroup: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        supplementGroup: { deleteMany: vi.fn() },
        product: { update: vi.fn() },
      })
    ),
  },
}));

import prisma from '@/lib/prisma';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductAvailability,
  slugify,
} from './menu-mutations';

const mockCatCreate = prisma.menuCategory.create as MockedFunction<
  typeof prisma.menuCategory.create
>;
const mockCatUpdate = prisma.menuCategory.update as MockedFunction<
  typeof prisma.menuCategory.update
>;
const mockCatDelete = prisma.menuCategory.delete as MockedFunction<
  typeof prisma.menuCategory.delete
>;
const mockCatFindUnique = prisma.menuCategory.findUnique as MockedFunction<
  typeof prisma.menuCategory.findUnique
>;
const mockCatFindMany = prisma.menuCategory.findMany as MockedFunction<
  typeof prisma.menuCategory.findMany
>;
const mockProdCreate = prisma.product.create as MockedFunction<
  typeof prisma.product.create
>;
const mockProdUpdate = prisma.product.update as MockedFunction<
  typeof prisma.product.update
>;
const mockProdDelete = prisma.product.delete as MockedFunction<
  typeof prisma.product.delete
>;
const mockProdFindUnique = prisma.product.findUnique as MockedFunction<
  typeof prisma.product.findUnique
>;
const mockProdFindMany = prisma.product.findMany as MockedFunction<
  typeof prisma.product.findMany
>;

describe('slugify', () => {
  it('met en minuscules et remplace les espaces par des tirets', () => {
    expect(slugify('Boissons Chaudes')).toBe('boissons-chaudes');
  });

  it('supprime les accents', () => {
    expect(slugify('Spécialités café')).toBe('specialites-cafe');
  });

  it('supprime les caractères non alphanumériques', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });
});

describe('createCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('crée une catégorie avec slug auto-généré et sortOrder = nb existants', async () => {
    mockCatFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);
    mockCatCreate.mockResolvedValue({ id: 'new' } as never);

    await createCategory({ name: 'Pâtisseries' });

    expect(mockCatCreate).toHaveBeenCalledWith({
      data: { name: 'Pâtisseries', slug: 'patisseries', sortOrder: 2 },
    });
  });

  it('rejette si le nom est vide', async () => {
    await expect(createCategory({ name: '' })).rejects.toThrow();
    expect(mockCatCreate).not.toHaveBeenCalled();
  });
});

describe('updateCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('met à jour le nom uniquement', async () => {
    mockCatUpdate.mockResolvedValue({} as never);
    await updateCategory('cat1', { name: 'Nouveau nom' });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { name: 'Nouveau nom' },
    });
  });
});

describe('deleteCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it("supprime la catégorie (cascade DB s'occupe des produits)", async () => {
    mockCatDelete.mockResolvedValue({} as never);
    await deleteCategory('cat1');
    expect(mockCatDelete).toHaveBeenCalledWith({ where: { id: 'cat1' } });
  });
});

describe('toggleCategoryAvailability', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inverse la disponibilité', async () => {
    mockCatFindUnique.mockResolvedValue({ available: true } as never);
    mockCatUpdate.mockResolvedValue({} as never);
    await toggleCategoryAvailability('cat1');
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { available: false },
    });
  });

  it("rejette si la catégorie n'existe pas", async () => {
    mockCatFindUnique.mockResolvedValue(null);
    await expect(toggleCategoryAvailability('x')).rejects.toThrow(
      'Catégorie introuvable'
    );
  });
});

describe('moveCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('échange sortOrder avec la catégorie voisine vers le haut', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
      { id: 'c', sortOrder: 2 },
    ] as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await moveCategory('b', 'up');

    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
  });

  it('ne fait rien si déjà en première position et direction "up"', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    await moveCategory('a', 'up');
    expect(mockCatUpdate).not.toHaveBeenCalled();
  });

  it('échange avec le suivant pour direction "down"', async () => {
    mockCatFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await moveCategory('a', 'down');

    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
  });
});

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
                  { name: 'Avoine', price: 500 },
                  { name: 'Amande', price: 500 },
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

describe('updateProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('met à jour les champs scalaires', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    await updateProduct('p1', {
      name: 'Renommé',
      description: 'Nouveau',
      price: 4000,
      imageUrl: null,
      supplementGroups: [],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("rejette si le produit n'existe pas", async () => {
    mockProdFindUnique.mockResolvedValue(null);
    await expect(
      updateProduct('x', {
        name: 'X',
        description: 'd',
        price: 100,
        imageUrl: null,
        supplementGroups: [],
      })
    ).rejects.toThrow('Produit introuvable');
  });
});

describe('deleteProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('supprime le produit', async () => {
    mockProdDelete.mockResolvedValue({} as never);
    await deleteProduct('p1');
    expect(mockProdDelete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });
});

describe('toggleProductAvailability', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inverse la disponibilité', async () => {
    mockProdFindUnique.mockResolvedValue({ available: true } as never);
    mockProdUpdate.mockResolvedValue({} as never);
    await toggleProductAvailability('p1');
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { available: false },
    });
  });
});
