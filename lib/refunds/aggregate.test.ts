import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: {
    refund: { groupBy: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
  },
}));

import prisma from '@/lib/prisma';
import {
  sumCashRefundsForDay,
  sumRefundsByDay,
  sumRefundsByMode,
  sumRefundsByModeForDay,
  totalOfModes,
} from './aggregate';

const day = new Date(Date.UTC(2026, 9, 19));
const COUNTED = { isPaid: true, status: { not: 'CANCELLED' } };

describe('agrégation des remboursements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CA du jour : payés, du jour de départ, commande encore comptée, par canal', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([
      { channel: 'WAVE', _sum: { amount: 900 } },
      { channel: 'CASH', _sum: { amount: null } },
    ] as never);

    const rec = await sumRefundsByModeForDay(day);

    expect(prisma.refund.groupBy).toHaveBeenCalledWith({
      by: ['channel'],
      where: { status: 'PAID', payoutDate: day, order: COUNTED },
      _sum: { amount: true },
    });
    expect(rec.WAVE).toBe(900);
    expect(rec.CASH).toBe(0);
    expect(totalOfModes(rec)).toBe(900);
  });

  it('plage : bornes inclusives sur la date de départ', async () => {
    vi.mocked(prisma.refund.groupBy).mockResolvedValue([] as never);
    const to = new Date(Date.UTC(2026, 9, 25));
    await sumRefundsByMode(day, to);
    expect(prisma.refund.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PAID',
          payoutDate: { gte: day, lte: to },
          order: COUNTED,
        },
      })
    );
  });

  it('par jour civil, ignore un remboursement sans date de départ', async () => {
    vi.mocked(prisma.refund.findMany).mockResolvedValue([
      { payoutDate: day, amount: 400 },
      { payoutDate: day, amount: 100 },
      { payoutDate: null, amount: 999 },
    ] as never);

    const map = await sumRefundsByDay(day, day);

    expect([...map.values()]).toEqual([500]);
  });

  it('trésorerie : les espèces rendues comptent même si la commande a été annulée (aucun filtre sur la commande)', async () => {
    vi.mocked(prisma.refund.aggregate).mockResolvedValue({
      _sum: { amount: 1500 },
    } as never);

    await expect(sumCashRefundsForDay(day)).resolves.toBe(1500);
    expect(prisma.refund.aggregate).toHaveBeenCalledWith({
      where: { status: 'PAID', payoutDate: day, channel: 'CASH' },
      _sum: { amount: true },
    });
  });

  it('aucun remboursement : zéro', async () => {
    vi.mocked(prisma.refund.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as never);
    await expect(sumCashRefundsForDay(day)).resolves.toBe(0);
  });
});
