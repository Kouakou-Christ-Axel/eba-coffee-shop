import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryCustomerPage = vi.hoisted(() => vi.fn());
const statsByCustomer = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());

vi.mock('./page-query', () => ({ queryCustomerPage }));
vi.mock('./stats', async (orig) => ({
  ...(await orig<typeof import('./stats')>()),
  statsByCustomer,
}));
vi.mock('@/lib/prisma', () => ({
  default: { customer: { findMany } },
}));

import { listCustomers, listCustomersWithDeferredStats } from './list';

const fiche = (id: string) => ({ id, name: id, phone: id });

beforeEach(() => {
  vi.clearAllMocks();
  queryCustomerPage.mockResolvedValue({ ids: ['b', 'a'], total: 2 });
  findMany.mockResolvedValue([fiche('a'), fiche('b')]);
  statsByCustomer.mockResolvedValue(
    new Map([['a', { ordersCount: 3, totalSpent: 9000, lastOrderAt: null }]])
  );
});

describe('listCustomers', () => {
  it('garde l’ordre de la requête SQL et ne charge pas les stats par défaut', async () => {
    const { customers } = await listCustomers({});
    expect(customers.map((c) => c.id)).toEqual(['b', 'a']);
    expect(customers[0].stats).toBeNull();
    expect(statsByCustomer).not.toHaveBeenCalled();
  });

  it('withStats : zéros pour un client sans commande', async () => {
    const { customers } = await listCustomers({ withStats: true });
    expect(customers.find((c) => c.id === 'a')?.stats?.ordersCount).toBe(3);
    expect(customers.find((c) => c.id === 'b')?.stats).toEqual({
      ordersCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    });
  });
});

describe('listCustomersWithDeferredStats', () => {
  it('démarre les stats AVANT que les fiches soient revenues', async () => {
    let releaseFiches!: () => void;
    findMany.mockReturnValue(
      new Promise((resolve) => {
        releaseFiches = () => resolve([fiche('a'), fiche('b')]);
      })
    );

    const pending = listCustomersWithDeferredStats({});
    await vi.waitFor(() => expect(findMany).toHaveBeenCalled());
    // Les fiches ne sont pas revenues, les stats sont déjà lancées.
    expect(statsByCustomer).toHaveBeenCalledWith(['b', 'a']);

    releaseFiches();
    const { customers, stats } = await pending;
    expect(customers.map((c) => c.id)).toEqual(['b', 'a']);
    expect(await stats).toEqual({
      a: { ordersCount: 3, totalSpent: 9000, lastOrderAt: null },
      b: { ordersCount: 0, totalSpent: 0, lastOrderAt: null },
    });
  });

  it('un échec des stats donne null sans faire échouer la liste', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    statsByCustomer.mockRejectedValue(new Error('db down'));
    const { customers, stats } = await listCustomersWithDeferredStats({});
    expect(customers).toHaveLength(2);
    expect(await stats).toBeNull();
  });
});
