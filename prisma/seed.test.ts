// prisma/seed.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/generated/prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $disconnect: vi.fn(),
  })),
}));

import { menu } from '@/config/menu';
import { seedMenu } from './seed';

describe('seedMenu', () => {
  it('insère exactement le même nombre de catégories que config/menu.ts', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      menuCategory: { create: mockCreate, deleteMany: mockDeleteMany },
    };

    await seedMenu(mockPrisma as never);

    expect(mockCreate).toHaveBeenCalledTimes(menu.length); // 4
  });

  it('insère les produits dans la première catégorie', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      menuCategory: { create: mockCreate, deleteMany: mockDeleteMany },
    };

    await seedMenu(mockPrisma as never);

    const firstCall = mockCreate.mock.calls[0][0];
    expect(firstCall.data.products.create.length).toBe(menu[0].products.length); // 5
  });

  it('insère les groupes et options de suppléments pour cappuccino', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      menuCategory: { create: mockCreate, deleteMany: mockDeleteMany },
    };

    await seedMenu(mockPrisma as never);

    // cappuccino = index 1 de la catégorie 0, a milkChoice (3 options) + coffeeExtras (4 options)
    const firstCall = mockCreate.mock.calls[0][0];
    const cappuccino = firstCall.data.products.create[1];
    expect(cappuccino.supplementGroups.create.length).toBe(2);
    expect(cappuccino.supplementGroups.create[0].options.create.length).toBe(3);
    expect(cappuccino.supplementGroups.create[1].options.create.length).toBe(4);
  });

  it("utilise l'id de la catégorie config comme slug", async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'cat-mock' });
    const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockPrisma = {
      menuCategory: { create: mockCreate, deleteMany: mockDeleteMany },
    };

    await seedMenu(mockPrisma as never);

    const firstCall = mockCreate.mock.calls[0][0];
    expect(firstCall.data.slug).toBe('boissons-chaudes');
  });
});
