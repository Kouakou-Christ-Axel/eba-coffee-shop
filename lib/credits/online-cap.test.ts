import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/daily-numbering', () => ({
  todayDailyDate: () => new Date('2026-10-21T00:00:00Z'),
}));

import { remainingOnlineCap } from './online-cap';

const tx = {
  customerCreditEntry: { findMany: vi.fn() },
  order: { findMany: vi.fn() },
};
const run = (cap = 5000) => remainingOnlineCap(tx as never, 'cu1', cap);

describe('remainingOnlineCap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('plafond entier quand rien n’a été dépensé aujourd’hui', async () => {
    tx.customerCreditEntry.findMany.mockResolvedValue([]);
    await expect(run()).resolves.toBe(5000);
    expect(tx.order.findMany).not.toHaveBeenCalled();
  });

  it('déduit les dépenses des commandes EN LIGNE, pas celles de la caisse', async () => {
    tx.customerCreditEntry.findMany.mockResolvedValue([
      { delta: -2000, orderId: 'o-online' },
      { delta: -1500, orderId: 'o-caisse' },
    ]);
    tx.order.findMany.mockResolvedValue([{ id: 'o-online' }]);
    await expect(run()).resolves.toBe(3000);
  });

  it('une restitution (paiement expiré) libère le plafond', async () => {
    tx.customerCreditEntry.findMany.mockResolvedValue([
      { delta: -3000, orderId: 'o1' },
      { delta: 3000, orderId: 'o1' },
    ]);
    tx.order.findMany.mockResolvedValue([{ id: 'o1' }]);
    await expect(run()).resolves.toBe(5000);
  });

  it('jamais négatif', async () => {
    tx.customerCreditEntry.findMany.mockResolvedValue([
      { delta: -9000, orderId: 'o1' },
    ]);
    tx.order.findMany.mockResolvedValue([{ id: 'o1' }]);
    await expect(run()).resolves.toBe(0);
  });
});
