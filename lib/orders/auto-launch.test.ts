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
import { StockShortageError } from './mutations/errors';

// 2026-10-22 10:00 à Abidjan (UTC+0). Chaque test avance l'horloge de 20 min
// pour passer le throttle ET le délai de retry (10 min) du test précédent.
let clock = new Date('2026-10-22T10:00:00Z').getTime();
const nextNow = () => new Date((clock += 20 * 60_000));
const shortage = () => new StockShortageError('pénurie');

describe('launchDueScheduledOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('cible les payées NEW du jour, sans stock déjà réservé ni remboursement', async () => {
    findMany.mockResolvedValue([]);
    const now = nextNow();
    await launchDueScheduledOrders(now);

    const { where, take, orderBy } = findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      status: 'NEW',
      isPaid: true,
      stockReservedAt: null,
      refunds: { none: { status: { in: expect.arrayContaining(['PAID']) } } },
    });
    // Fenêtre = jour civil Abidjan de `now`.
    expect(where.pickupTime.gte.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(where.pickupTime.lte.getTime()).toBeGreaterThan(
      new Date('2026-10-22T23:59:00Z').getTime()
    );
    expect(where.pickupTime.lte.getTime()).toBeLessThan(
      new Date('2026-10-23T00:00:00Z').getTime()
    );
    expect(take).toBe(20);
    expect(orderBy).toEqual({ pickupTime: 'asc' });
  });

  it('lance chaque commande sans forcer la pénurie', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    send.mockResolvedValue(undefined);

    const res = await launchDueScheduledOrders(nextNow());

    expect(res).toEqual({ launched: 2, skipped: 0 });
    expect(send).toHaveBeenCalledWith('a', 'ADMIN', { notifyShortage: false });
    expect(send).toHaveBeenCalledWith('b', 'ADMIN', { notifyShortage: false });
  });

  it('une pénurie laisse la commande au lancement manuel, sans bloquer les autres', async () => {
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    send.mockRejectedValueOnce(shortage()).mockResolvedValue(undefined);

    const res = await launchDueScheduledOrders(nextNow());

    expect(res).toEqual({ launched: 1, skipped: 1 });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('une erreur inattendue est journalisée en erreur, pas en avertissement', async () => {
    findMany.mockResolvedValue([{ id: 'a' }]);
    send.mockRejectedValue(new Error('base indisponible'));

    await launchDueScheduledOrders(nextNow());

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('ne retente pas une commande refusée avant 10 min, puis la retente', async () => {
    findMany.mockResolvedValue([{ id: 'x' }]);
    send.mockRejectedValue(shortage());
    const t0 = nextNow();
    await launchDueScheduledOrders(t0);

    findMany.mockResolvedValue([]);
    await launchDueScheduledOrders(new Date(t0.getTime() + 2 * 60_000));
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: ['x'] } }),
      })
    );

    await launchDueScheduledOrders(new Date(t0.getTime() + 11 * 60_000));
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { notIn: [] } }),
      })
    );
  });

  it('force (réappro) : repasse sans attendre ni la minute de throttle ni le délai de retry', async () => {
    findMany.mockResolvedValue([{ id: 'x' }]);
    send.mockRejectedValue(shortage());
    const now = nextNow();
    await launchDueScheduledOrders(now);

    // Stock arrivé 1 s plus tard : la commande refusée est retentée.
    findMany.mockResolvedValue([{ id: 'x' }]);
    send.mockResolvedValue(undefined);
    const res = await launchDueScheduledOrders(new Date(now.getTime() + 1000), {
      force: true,
    });

    expect(res).toEqual({ launched: 1, skipped: 0 });
  });

  it('une panne de lecture ne gèle pas les passages suivants', async () => {
    findMany.mockRejectedValueOnce(new Error('timeout'));
    const t0 = nextNow();
    await expect(launchDueScheduledOrders(t0)).rejects.toThrow('timeout');

    findMany.mockResolvedValue([]);
    await launchDueScheduledOrders(new Date(t0.getTime() + 1000));

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('passages concurrents : un seul lit à la fois, le réappro en rejoue UN derrière', async () => {
    let release!: () => void;
    findMany.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve([])))
    );
    findMany.mockResolvedValue([]);

    const first = launchDueScheduledOrders(nextNow(), { force: true });
    // Deux réappros pendant le passage en cours : aucune lecture parallèle.
    await launchDueScheduledOrders(nextNow(), { force: true });
    await launchDueScheduledOrders(nextNow(), { force: true });
    expect(findMany).toHaveBeenCalledTimes(1);

    release();
    await first;
    await vi.waitFor(() => expect(findMany).toHaveBeenCalledTimes(2));
  });
});
