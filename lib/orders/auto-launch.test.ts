import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findMany, send } = vi.hoisted(() => ({
  findMany: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany } },
}));
vi.mock('./mutations/kitchen', () => ({ sendOrderToKitchen: send }));

import { launchDueScheduledOrders } from './auto-launch';

let clock = new Date('2026-10-22T08:00:00Z').getTime();
// Chaque test avance l'horloge pour passer le throttle d'une minute.
const nextNow = () => new Date((clock += 5 * 60_000));

describe('launchDueScheduledOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('cible les payées NEW du jour, sans stock déjà réservé', async () => {
    findMany.mockResolvedValue([]);
    await launchDueScheduledOrders(nextNow());

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'NEW',
          isPaid: true,
          stockReservedAt: null,
        }),
      })
    );
  });

  it('lance chaque commande sans forcer la pénurie', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    send.mockResolvedValue(undefined);

    const res = await launchDueScheduledOrders(nextNow());

    expect(res).toEqual({ launched: 2, skipped: 0 });
    expect(send).toHaveBeenCalledWith('a', 'ADMIN');
    expect(send).toHaveBeenCalledWith('b', 'ADMIN');
  });

  it('une pénurie laisse la commande au lancement manuel, sans bloquer les autres', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    send
      .mockRejectedValueOnce(new Error('pénurie'))
      .mockResolvedValue(undefined);

    const res = await launchDueScheduledOrders(nextNow());

    expect(res).toEqual({ launched: 1, skipped: 1 });
  });

  it('ne retente pas une commande refusée au passage suivant', async () => {
    findMany.mockResolvedValue([{ id: 'x' }]);
    send.mockRejectedValue(new Error('pénurie'));
    await launchDueScheduledOrders(nextNow());

    findMany.mockResolvedValue([]);
    await launchDueScheduledOrders(nextNow());

    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['x'] } }),
      })
    );
  });
});
