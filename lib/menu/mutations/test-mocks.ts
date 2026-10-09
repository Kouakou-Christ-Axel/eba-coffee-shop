// Fabrique du mock Prisma (le `vi.mock` reste dans chaque test, hoisting vitest).

import { vi } from 'vitest';

export function prismaModuleMock() {
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
    // Même client dans les transactions : les assertions de premier niveau les couvrent.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(client)
    ),
  };
  return { default: client };
}
