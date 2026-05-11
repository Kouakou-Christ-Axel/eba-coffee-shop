// lib/auth.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockedFunction,
} from 'vitest';

vi.mock('better-auth', () => ({
  betterAuth: vi.fn().mockReturnValue({ api: {} }),
}));

vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn(),
}));

vi.mock('better-auth/next-js', () => ({
  nextCookies: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      update: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';
import { promoteAdminIfMatch } from './auth';

const mockUpdate = prisma.user.update as MockedFunction<
  typeof prisma.user.update
>;

describe('promoteAdminIfMatch', () => {
  const savedAdminEmail = process.env.ADMIN_EMAIL;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.ADMIN_EMAIL = 'admin@eba.ci';
  });

  afterEach(() => {
    if (savedAdminEmail === undefined) {
      delete process.env.ADMIN_EMAIL;
    } else {
      process.env.ADMIN_EMAIL = savedAdminEmail;
    }
  });

  it("attribue le rôle ADMIN si l'email correspond à ADMIN_EMAIL", async () => {
    await promoteAdminIfMatch({ id: 'u1', email: 'admin@eba.ci' });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { role: 'ADMIN' },
    });
  });

  it("n'appelle pas prisma si l'email ne correspond pas", async () => {
    await promoteAdminIfMatch({ id: 'u2', email: 'autre@test.com' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("n'appelle pas prisma si ADMIN_EMAIL n'est pas défini", async () => {
    delete process.env.ADMIN_EMAIL;
    await promoteAdminIfMatch({ id: 'u3', email: 'admin@eba.ci' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
