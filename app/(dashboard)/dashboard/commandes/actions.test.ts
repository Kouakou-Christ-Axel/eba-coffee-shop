// app/(dashboard)/dashboard/commandes/actions.test.ts
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { updateOrderStatus } from './actions';

const mockGetSession = auth.api.getSession as MockedFunction<
  typeof auth.api.getSession
>;
const mockFindUnique = prisma.order.findUnique as MockedFunction<
  typeof prisma.order.findUnique
>;
const mockUpdate = prisma.order.update as MockedFunction<
  typeof prisma.order.update
>;

const adminSession = {
  user: { role: 'ADMIN', id: 'u1', email: 'admin@eba.ci' },
  session: {},
} as never;

describe('updateOrderStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('met à jour le statut pour une transition valide (PENDING → CONFIRMED)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({ id: 'o1', status: 'PENDING' } as never);
    mockUpdate.mockResolvedValue({} as never);

    await updateOrderStatus('o1', 'CONFIRMED');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'CONFIRMED' },
    });
  });

  it('lève une erreur si pas de session', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Non autorisé'
    );
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('lève une erreur si rôle USER', async () => {
    mockGetSession.mockResolvedValue({
      user: { role: 'USER', id: 'u1' },
      session: {},
    } as never);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Non autorisé'
    );
  });

  it('lève une erreur pour transition invalide (PICKED_UP → PENDING)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'PICKED_UP',
    } as never);

    await expect(updateOrderStatus('o1', 'PENDING')).rejects.toThrow(
      'Transition invalide'
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('lève une erreur pour transition invalide (CANCELLED → CONFIRMED)', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'CANCELLED',
    } as never);

    await expect(updateOrderStatus('o1', 'CONFIRMED')).rejects.toThrow(
      'Transition invalide'
    );
  });

  it('autorise CONFIRMED → READY', async () => {
    mockGetSession.mockResolvedValue(adminSession);
    mockFindUnique.mockResolvedValue({
      id: 'o1',
      status: 'CONFIRMED',
    } as never);
    mockUpdate.mockResolvedValue({} as never);

    await updateOrderStatus('o1', 'READY');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'READY' },
    });
  });
});
