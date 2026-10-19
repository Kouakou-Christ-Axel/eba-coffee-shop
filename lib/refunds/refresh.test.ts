import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RefundPrisma } from './test-utils';

const { prisma } = vi.hoisted(() => ({
  prisma: {} as RefundPrisma,
}));
vi.mock('@/lib/prisma', async () => {
  Object.assign(prisma, (await import('./test-utils')).refundPrismaMock());
  return { default: prisma };
});
vi.mock('@/lib/jeko/config', () => ({ jekoConfig: vi.fn() }));
vi.mock('@/lib/jeko/transfers', () => ({ getJekoTransfer: vi.fn() }));
vi.mock('./on-paid', () => ({ settleRefundPaid: vi.fn() }));
vi.mock('./alerts', () => ({ notifyRefundProblem: vi.fn() }));

import { JekoApiError } from '@/lib/jeko/client';
import { jekoConfig } from '@/lib/jeko/config';
import { getJekoTransfer } from '@/lib/jeko/transfers';
import { notifyRefundProblem } from './alerts';
import { settleRefundPaid } from './on-paid';
import { refreshPendingRefunds } from './refresh';

const transfer = vi.mocked(getJekoTransfer);
const settle = vi.mocked(settleRefundPaid);
const alert = vi.mocked(notifyRefundProblem);

const NOW = new Date('2026-10-19T10:00:00Z');
let n = 0;
const clock = (step: number) => new Date(NOW.getTime() + step * 120_000);
// Âge relatif à l'instant du PROCHAIN passage (run() avance l'horloge).
const at = (minutesAgo: number) =>
  new Date(clock(n + 1).getTime() - minutesAgo * 60_000);

// Chaque test avance l'horloge : la limite d'un passage par minute est en mémoire.
async function run() {
  n += 1;
  return refreshPendingRefunds(clock(n));
}

describe('refreshPendingRefunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refund.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    prisma.refund.updateMany.mockResolvedValue({ count: 1 });
    vi.mocked(jekoConfig).mockReturnValue({
      apiKey: 'k',
      apiKeyId: 'i',
      storeId: 's',
    });
    settle.mockResolvedValue(true);
  });

  it('transfert abouti chez Jèko : passe à PAID avec ses frais', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { id: 'r1', jekoTransferId: 'wth_1', updatedAt: at(1) },
    ]);
    transfer.mockResolvedValue({
      id: 'wth_1',
      status: 'success',
      feeFcfa: 12,
      errorCode: null,
    });

    await expect(run()).resolves.toEqual({ paid: 1, failed: 0, uncertain: 0 });
    expect(settle).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', from: ['PROCESSING'], feeFcfa: 12 })
    );
  });

  it('transfert en erreur : FAILED avec la raison de Jèko, l’admin est prévenu', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { id: 'r1', jekoTransferId: 'wth_1', updatedAt: at(1) },
    ]);
    transfer.mockResolvedValue({
      id: 'wth_1',
      status: 'error',
      feeFcfa: 0,
      errorCode: 'transfer_failed',
    });

    await expect(run()).resolves.toMatchObject({ failed: 1 });
    expect(prisma.refund.updateMany).toHaveBeenCalledWith({
      where: { id: 'r1', status: 'PROCESSING' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureCode: 'transfer_failed',
      }),
    });
    expect(alert).toHaveBeenCalledWith('r1', 'FAILED');
  });

  it('toujours pending : ne touche à rien', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { id: 'r1', jekoTransferId: 'wth_1', updatedAt: at(1) },
    ]);
    transfer.mockResolvedValue({
      id: 'wth_1',
      status: 'pending',
      feeFcfa: 0,
      errorCode: null,
    });
    await expect(run()).resolves.toEqual({ paid: 0, failed: 0, uncertain: 0 });
    expect(settle).not.toHaveBeenCalled();
    expect(prisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('réclamé mais sans identifiant depuis trop longtemps : « à vérifier »', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { id: 'r1', jekoTransferId: null, updatedAt: at(30) },
      { id: 'r2', jekoTransferId: null, updatedAt: at(1) },
    ]);
    await expect(run()).resolves.toMatchObject({ uncertain: 1 });
    expect(alert).toHaveBeenCalledWith('r1', 'UNCERTAIN');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(transfer).not.toHaveBeenCalled();
  });

  it('Jèko injoignable : on réessaiera, rien ne bouge et rien ne plante', async () => {
    prisma.refund.findMany.mockResolvedValue([
      { id: 'r1', jekoTransferId: 'wth_1', updatedAt: at(1) },
    ]);
    transfer.mockRejectedValue(
      new JekoApiError(503, 'network_error', 'Jèko injoignable')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(run()).resolves.toEqual({ paid: 0, failed: 0, uncertain: 0 });
    expect(prisma.refund.updateMany).not.toHaveBeenCalled();
  });

  it('un seul passage par minute', async () => {
    prisma.refund.findMany.mockResolvedValue([]);
    const t = clock(999);
    await refreshPendingRefunds(t);
    prisma.refund.findMany.mockClear();
    await refreshPendingRefunds(new Date(t.getTime() + 10_000));
    expect(prisma.refund.findMany).not.toHaveBeenCalled();
  });
});
