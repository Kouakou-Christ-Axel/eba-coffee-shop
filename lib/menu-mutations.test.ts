// lib/menu-mutations.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => {
  const client = {
    menuCategory: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    product: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    supplementGroup: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    supplementOption: {
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    productSchedule: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    productWeeklySpecial: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    // Les transactions reçoivent le même client mocké : les assertions sur les
    // mocks de premier niveau couvrent donc aussi les opérations transactionnelles.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(client)
    ),
  };
  return { default: client };
});

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
  moveProduct,
  slugify,
  createProductSchedule,
  updateProductSchedule,
  deleteProductSchedule,
  createProductWeeklySpecial,
  updateProductWeeklySpecial,
  deleteProductWeeklySpecial,
} from './menu-mutations';

const mockCatCreate = prisma.menuCategory.create as MockedFunction<
  typeof prisma.menuCategory.create
>;
const mockCatUpdate = prisma.menuCategory.update as MockedFunction<
  typeof prisma.menuCategory.update
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
const mockProdUpdateMany = prisma.product.updateMany as MockedFunction<
  typeof prisma.product.updateMany
>;
const mockProdFindUnique = prisma.product.findUnique as MockedFunction<
  typeof prisma.product.findUnique
>;
const mockProdFindMany = prisma.product.findMany as MockedFunction<
  typeof prisma.product.findMany
>;
const mockSupGroupFindMany = prisma.supplementGroup.findMany as MockedFunction<
  typeof prisma.supplementGroup.findMany
>;
const mockSupGroupCreate = prisma.supplementGroup.create as MockedFunction<
  typeof prisma.supplementGroup.create
>;
const mockSupOptionUpdate = prisma.supplementOption.update as MockedFunction<
  typeof prisma.supplementOption.update
>;
const mockSupOptionCreate = prisma.supplementOption.create as MockedFunction<
  typeof prisma.supplementOption.create
>;
const mockSupOptionDeleteMany = prisma.supplementOption
  .deleteMany as MockedFunction<typeof prisma.supplementOption.deleteMany>;
const mockScheduleCreate = prisma.productSchedule.create as MockedFunction<
  typeof prisma.productSchedule.create
>;
const mockScheduleUpdate = prisma.productSchedule.update as MockedFunction<
  typeof prisma.productSchedule.update
>;
const mockScheduleDelete = prisma.productSchedule.delete as MockedFunction<
  typeof prisma.productSchedule.delete
>;
const mockWeeklySpecialCreate = prisma.productWeeklySpecial
  .create as MockedFunction<typeof prisma.productWeeklySpecial.create>;
const mockWeeklySpecialUpdate = prisma.productWeeklySpecial
  .update as MockedFunction<typeof prisma.productWeeklySpecial.update>;
const mockWeeklySpecialDelete = prisma.productWeeklySpecial
  .delete as MockedFunction<typeof prisma.productWeeklySpecial.delete>;

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
      data: {
        name: 'Pâtisseries',
        slug: 'patisseries',
        sortOrder: 2,
        scheduleId: null,
        advanceOrderDays: null,
      },
    });
  });

  it('rejette si le nom est vide', async () => {
    await expect(createCategory({ name: '' })).rejects.toThrow();
    expect(mockCatCreate).not.toHaveBeenCalled();
  });

  it('assigne un planning récurrent via scheduleId', async () => {
    mockCatFindMany.mockResolvedValue([] as never);
    mockCatCreate.mockResolvedValue({ id: 'new' } as never);

    await createCategory({ name: 'Brunch', scheduleId: 'sched1' });

    expect(mockCatCreate).toHaveBeenCalledWith({
      data: {
        name: 'Brunch',
        slug: 'brunch',
        sortOrder: 0,
        scheduleId: 'sched1',
        advanceOrderDays: null,
      },
    });
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

  it('scheduleId absent → inchangé (mise à jour partielle)', async () => {
    mockCatUpdate.mockResolvedValue({} as never);
    await updateCategory('cat1', { name: 'Renommée' });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { name: 'Renommée' },
    });
  });

  it('scheduleId: null efface volontairement le planning assigné', async () => {
    mockCatUpdate.mockResolvedValue({} as never);
    await updateCategory('cat1', { scheduleId: null });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { scheduleId: null },
    });
  });
});

describe('deleteCategory', () => {
  beforeEach(() => vi.resetAllMocks());

  it('soft delete : marque la catégorie ET ses produits, dé-collisionne le slug', async () => {
    mockCatFindUnique.mockResolvedValue({
      slug: 'cafes',
      deletedAt: null,
    } as never);
    mockProdUpdateMany.mockResolvedValue({ count: 2 } as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await deleteCategory('cat1');

    expect(mockProdUpdateMany).toHaveBeenCalledWith({
      where: { categoryId: 'cat1', deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'cat1' },
      data: { deletedAt: expect.any(Date), slug: 'cafes-deleted-cat1' },
    });
  });

  it('rejette si la catégorie est introuvable', async () => {
    mockCatFindUnique.mockResolvedValue(null);
    await expect(deleteCategory('x')).rejects.toThrow('Catégorie introuvable');
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
                  {
                    name: 'Avoine',
                    price: 500,
                    available: true,
                    stockQuantity: null,
                  },
                  {
                    name: 'Amande',
                    price: 500,
                    available: true,
                    stockQuantity: null,
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

describe('updateProduct', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSupGroupFindMany.mockResolvedValue([] as never);
  });

  it('met à jour les champs scalaires', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);
    await updateProduct('p1', {
      name: 'Renommé',
      description: 'Nouveau',
      price: 4000,
      imageUrl: null,
      supplementGroups: [],
    });

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('crée un nouveau groupe de suppléments absent en base (upsert par nom)', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);
    mockSupGroupFindMany.mockResolvedValue([] as never);

    await updateProduct('p1', {
      supplementGroups: [
        {
          name: 'Goûts',
          type: 'quantity',
          required: true,
          available: true,
          minSelect: 3,
          maxSelect: 3,
          options: [
            { name: 'Vanille', price: 0, available: true },
            { name: 'Chocolat', price: 0, available: true },
          ],
        },
      ],
    });

    expect(mockSupGroupCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Goûts',
        type: 'quantity',
        minSelect: 3,
        maxSelect: 3,
        productId: 'p1',
      }),
    });
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

  it('partiel : ne modifie que le prix sans toucher aux suppléments', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);

    await updateProduct('p1', { price: 5000 });

    // Pas de suppléments fournis → pas de transaction (suppléments préservés).
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { price: 5000 },
    });
  });

  it('partiel : accepte un chemin d’upload local comme imageUrl', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);

    await updateProduct('p1', { imageUrl: '/uploads/products/x.jpg' });

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { imageUrl: '/uploads/products/x.jpg' },
    });
  });

  it('déplace le produit vers une autre catégorie via categoryId', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);

    await updateProduct('p1', { categoryId: 'cat2' });

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { categoryId: 'cat2' },
    });
  });

  it('assigne un planning récurrent via scheduleId', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);

    await updateProduct('p1', { scheduleId: 'sched1' });

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { scheduleId: 'sched1' },
    });
  });

  it('scheduleId: null efface volontairement le planning assigné', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);

    await updateProduct('p1', { scheduleId: null });

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { scheduleId: null },
    });
  });

  // Régression : deux options portant le même nom en base (données
  // historiques corrompues) empêchaient toute suppression du doublon — la
  // Map par nom collapsait les deux lignes en une seule cible, l'autre
  // survivait indéfiniment (et faisait échouer le décrément de stock au
  // paiement par ambiguïté, cf. lib/order-mutations.ts). L'appariement doit
  // consommer une file par nom, pas une valeur unique.
  it('supprime le doublon quand deux options existantes partagent un nom et qu’une seule est soumise', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockProdUpdate.mockResolvedValue({ id: 'p1' } as never);
    mockSupGroupFindMany.mockResolvedValue([
      {
        id: 'g1',
        name: 'Choisissez vos goûts',
        options: [
          {
            id: 'opt-disabled',
            name: 'Cacahuète vanille',
            price: 0,
            available: false,
            stockQuantity: null,
          },
          {
            id: 'opt-active',
            name: 'Cacahuète vanille',
            price: 0,
            available: true,
            stockQuantity: 12,
          },
          {
            id: 'opt-bissap',
            name: 'Bissap',
            price: 0,
            available: true,
            stockQuantity: 3,
          },
        ],
      },
    ] as never);

    await updateProduct('p1', {
      supplementGroups: [
        {
          name: 'Choisissez vos goûts',
          type: 'quantity',
          required: true,
          available: true,
          minSelect: 3,
          maxSelect: 3,
          options: [
            {
              name: 'Cacahuète vanille',
              price: 0,
              available: true,
              stockQuantity: 12,
            },
            { name: 'Bissap', price: 0, available: true, stockQuantity: 3 },
          ],
        },
      ],
    });

    // Une seule des deux lignes "Cacahuète vanille" est mise à jour (l'ordre
    // dans lequel Prisma les a retournées, peu importe laquelle exactement),
    // l'autre est supprimée — jamais les deux mises à jour, jamais aucune
    // supprimée.
    expect(mockSupOptionUpdate).toHaveBeenCalledWith({
      where: { id: 'opt-disabled' },
      data: expect.objectContaining({
        name: 'Cacahuète vanille',
        available: true,
      }),
    });
    expect(mockSupOptionUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'opt-active' } })
    );
    expect(mockSupOptionDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['opt-active'] } },
    });
    expect(mockSupOptionCreate).not.toHaveBeenCalled();
  });
});

describe('moveProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('échange le sortOrder avec le voisin dans la même catégorie', async () => {
    mockProdFindUnique.mockResolvedValue({ categoryId: 'cat1' } as never);
    mockProdFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    mockProdUpdate.mockResolvedValue({} as never);

    await moveProduct('a', 'down');

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
  });

  it('ne fait rien en bord de liste', async () => {
    mockProdFindUnique.mockResolvedValue({ categoryId: 'cat1' } as never);
    mockProdFindMany.mockResolvedValue([
      { id: 'a', sortOrder: 0 },
      { id: 'b', sortOrder: 1 },
    ] as never);
    await moveProduct('a', 'up');
    expect(mockProdUpdate).not.toHaveBeenCalled();
  });

  it("rejette si le produit n'existe pas", async () => {
    mockProdFindUnique.mockResolvedValue(null);
    await expect(moveProduct('x', 'up')).rejects.toThrow('Produit introuvable');
  });
});

describe('deleteProduct', () => {
  beforeEach(() => vi.resetAllMocks());

  it('soft delete : marque le produit comme supprimé', async () => {
    mockProdUpdate.mockResolvedValue({} as never);
    await deleteProduct('p1');
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { deletedAt: expect.any(Date) },
    });
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

describe('createProductSchedule', () => {
  beforeEach(() => vi.resetAllMocks());

  it('crée un planning avec jours triés et dédoublonnés', async () => {
    mockScheduleCreate.mockResolvedValue({ id: 'sched1' } as never);
    await createProductSchedule({
      name: 'Jour du chocolat',
      days: [3, 3, 0, 6],
    });
    expect(mockScheduleCreate).toHaveBeenCalledWith({
      data: { name: 'Jour du chocolat', days: [0, 3, 6] },
    });
  });

  it('rejette un planning sans jour', async () => {
    await expect(
      createProductSchedule({ name: 'Vide', days: [] })
    ).rejects.toThrow();
    expect(mockScheduleCreate).not.toHaveBeenCalled();
  });

  it('rejette un nom vide', async () => {
    await expect(
      createProductSchedule({ name: '', days: [3] })
    ).rejects.toThrow();
  });
});

describe('updateProductSchedule', () => {
  beforeEach(() => vi.resetAllMocks());

  it('met à jour partiellement (jours seuls)', async () => {
    mockScheduleUpdate.mockResolvedValue({} as never);
    await updateProductSchedule('sched1', { days: [1, 5] });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({
      where: { id: 'sched1' },
      data: { days: [1, 5] },
    });
  });

  it('met à jour partiellement (nom seul)', async () => {
    mockScheduleUpdate.mockResolvedValue({} as never);
    await updateProductSchedule('sched1', { name: 'Renommé' });
    expect(mockScheduleUpdate).toHaveBeenCalledWith({
      where: { id: 'sched1' },
      data: { name: 'Renommé' },
    });
  });
});

describe('deleteProductSchedule', () => {
  beforeEach(() => vi.resetAllMocks());

  it('supprime le planning (désassignation via onDelete: SetNull côté DB)', async () => {
    mockScheduleDelete.mockResolvedValue({} as never);
    await deleteProductSchedule('sched1');
    expect(mockScheduleDelete).toHaveBeenCalledWith({
      where: { id: 'sched1' },
    });
  });
});

describe('createProductWeeklySpecial', () => {
  beforeEach(() => vi.resetAllMocks());

  it('programme une fenêtre pour un produit existant', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    mockWeeklySpecialCreate.mockResolvedValue({ id: 'ws1' } as never);

    await createProductWeeklySpecial('p1', {
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      note: 'Lancement',
    });

    expect(mockWeeklySpecialCreate).toHaveBeenCalledWith({
      data: {
        productId: 'p1',
        startDate: new Date('2026-08-03'),
        endDate: new Date('2026-08-09'),
        note: 'Lancement',
      },
    });
  });

  it('rejette si le produit est introuvable', async () => {
    mockProdFindUnique.mockResolvedValue(null);
    await expect(
      createProductWeeklySpecial('x', {
        startDate: '2026-08-03',
        endDate: '2026-08-09',
      })
    ).rejects.toThrow('Produit introuvable');
  });

  it('rejette une fenêtre où la fin précède le début', async () => {
    mockProdFindUnique.mockResolvedValue({ id: 'p1' } as never);
    await expect(
      createProductWeeklySpecial('p1', {
        startDate: '2026-08-09',
        endDate: '2026-08-03',
      })
    ).rejects.toThrow();
    expect(mockWeeklySpecialCreate).not.toHaveBeenCalled();
  });
});

describe('updateProductWeeklySpecial', () => {
  beforeEach(() => vi.resetAllMocks());

  it('corrige une fenêtre existante de façon partielle', async () => {
    mockWeeklySpecialUpdate.mockResolvedValue({} as never);
    await updateProductWeeklySpecial('ws1', { note: 'Corrigé' });
    expect(mockWeeklySpecialUpdate).toHaveBeenCalledWith({
      where: { id: 'ws1' },
      data: { note: 'Corrigé' },
    });
  });
});

describe('deleteProductWeeklySpecial', () => {
  beforeEach(() => vi.resetAllMocks());

  it('retire une ligne de l’historique', async () => {
    mockWeeklySpecialDelete.mockResolvedValue({} as never);
    await deleteProductWeeklySpecial('ws1');
    expect(mockWeeklySpecialDelete).toHaveBeenCalledWith({
      where: { id: 'ws1' },
    });
  });
});
