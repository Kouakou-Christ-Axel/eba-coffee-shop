import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', async () =>
  (await import('./test-mocks')).prismaModuleMock()
);
vi.mock('@/lib/restock-alerts', () => ({ triggerRestockAlerts: vi.fn() }));

import {
  createProductSchedule,
  updateProductSchedule,
  deleteProductSchedule,
  createProductWeeklySpecial,
  updateProductWeeklySpecial,
  deleteProductWeeklySpecial,
} from '@/lib/menu-mutations';
import {
  mockProdFindUnique,
  mockScheduleCreate,
  mockScheduleUpdate,
  mockScheduleDelete,
  mockWeeklySpecialCreate,
  mockWeeklySpecialUpdate,
  mockWeeklySpecialDelete,
} from './test-utils';

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

// ─── Alertes « de retour » ────────────────────────────────────────────────────
