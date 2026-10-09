import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('./test-mocks')).prismaModuleMock()
);
vi.mock('@/lib/restock-alerts', () => ({ triggerRestockAlerts: vi.fn() }));

import {
  deleteProduct,
  toggleProductAvailability,
  moveProduct,
  reorderProducts,
} from '@/lib/menu-mutations';
import {
  mockProdUpdate,
  mockProdFindUnique,
  mockProdFindMany,
} from './test-utils';

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

describe('reorderProducts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('réindexe sortOrder sur la position dans la liste reçue', async () => {
    mockProdFindMany.mockResolvedValue([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ] as never);
    mockProdUpdate.mockResolvedValue({} as never);

    await reorderProducts('cat1', ['c', 'a', 'b']);

    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'c' },
      data: { sortOrder: 0 },
    });
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'a' },
      data: { sortOrder: 1 },
    });
    expect(mockProdUpdate).toHaveBeenCalledWith({
      where: { id: 'b' },
      data: { sortOrder: 2 },
    });
  });

  // Garde-fou contre l'écrasement silencieux : la liste rendue au client peut
  // être périmée (produit créé ou supprimé entre-temps par un autre admin ou
  // par un outil MCP). Réindexer dessus effacerait sa modification.
  it('rejette un ordre incomplet sans rien écrire', async () => {
    mockProdFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);

    await expect(reorderProducts('cat1', ['a'])).rejects.toThrow(
      'La liste des produits a changé'
    );
    expect(mockProdUpdate).not.toHaveBeenCalled();
  });

  it('rejette un ordre contenant un id inconnu', async () => {
    mockProdFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);

    await expect(reorderProducts('cat1', ['a', 'z'])).rejects.toThrow(
      'La liste des produits a changé'
    );
    expect(mockProdUpdate).not.toHaveBeenCalled();
  });

  it('rejette un ordre contenant un doublon', async () => {
    mockProdFindMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as never);

    await expect(reorderProducts('cat1', ['a', 'a'])).rejects.toThrow(
      'La liste des produits a changé'
    );
    expect(mockProdUpdate).not.toHaveBeenCalled();
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
