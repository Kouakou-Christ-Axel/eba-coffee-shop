import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('./test-mocks')).prismaModuleMock()
);
vi.mock('@/lib/restock-alerts', () => ({ triggerRestockAlerts: vi.fn() }));

import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryAvailability,
  moveCategory,
  reorderCategories,
  slugify,
} from '@/lib/menu-mutations';
import {
  mockCatCreate,
  mockCatUpdate,
  mockCatFindUnique,
  mockCatFindMany,
  mockProdUpdateMany,
} from './test-utils';

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

describe('reorderCategories', () => {
  beforeEach(() => vi.resetAllMocks());

  it('réindexe sortOrder sur la position dans la liste reçue', async () => {
    mockCatFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);
    mockCatUpdate.mockResolvedValue({} as never);

    await reorderCategories(['b', 'a']);

    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 0 },
    });
    expect(mockCatUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
  });

  it('rejette un ordre périmé sans rien écrire', async () => {
    mockCatFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);

    await expect(reorderCategories(['a'])).rejects.toThrow(
      'La liste des catégories a changé'
    );
    expect(mockCatUpdate).not.toHaveBeenCalled();
  });
});
