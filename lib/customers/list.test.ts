import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ default: { $queryRaw: queryRaw } }));

import { listCustomers, listCustomersWithStats } from './list';
import { getPageStats } from './stats';

const sqlOf = (call: unknown[]) => (call[0] as { sql: string }).sql;
const valuesOf = (call: unknown[]) => (call[0] as { values: unknown[] }).values;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requêtes de la page clients', () => {
  it('la liste : une requête de fiches + une de total, indépendantes de toute stat', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([{ total: 42 }]);

    const res = await listCustomers({ search: 'kou', page: 2 });

    expect(res).toMatchObject({ total: 42, pageSize: 20 });
    expect(res.customers.map((c) => c.id)).toEqual(['a', 'b']);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    for (const call of queryRaw.mock.calls) {
      expect(sqlOf(call)).not.toContain('"order"');
    }
    // OFFSET de la page 2.
    expect(valuesOf(queryRaw.mock.calls[0])).toContain(20);
  });

  it('les stats : même filtre rejoué, agrégats seulement sur la sous-requête de la page', async () => {
    queryRaw.mockResolvedValueOnce([
      { id: 'a', orders: 3, net: 9000, last_order: null },
    ]);

    const stats = await getPageStats({ search: 'kou', page: 2 });

    expect(stats).toEqual({
      a: { ordersCount: 3, totalSpent: 9000, lastOrderAt: null },
    });
    const sql = sqlOf(queryRaw.mock.calls[0]);
    expect(sql).toContain('LATERAL');
    expect(sql).toContain('LIMIT');
    // Même filtre que la liste : mêmes valeurs liées (terme replié, limite, offset).
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);
    await listCustomers({ search: 'kou', page: 2 });
    const listValues = valuesOf(queryRaw.mock.calls[1]);
    for (const v of listValues) {
      expect(valuesOf(queryRaw.mock.calls[0])).toContain(v);
    }
  });

  it('un tri sur une stat joint les agrégats de tous les clients, pas un tri sur le nom', async () => {
    queryRaw.mockResolvedValue([]);
    await getPageStats({ sort: 'totalSpent' });
    expect(sqlOf(queryRaw.mock.calls[0])).toContain('GROUP BY');
    queryRaw.mockClear();
    await getPageStats({ sort: 'name' });
    expect(sqlOf(queryRaw.mock.calls[0])).not.toContain('GROUP BY');
  });

  it('listCustomersWithStats : joint par id, zéros pour un client sans commande', async () => {
    queryRaw
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 'a', orders: 3, net: 9000, last_order: null },
      ]);

    const { customers } = await listCustomersWithStats({});

    expect(customers.find((c) => c.id === 'a')?.stats.ordersCount).toBe(3);
    expect(customers.find((c) => c.id === 'b')?.stats).toEqual({
      ordersCount: 0,
      totalSpent: 0,
      lastOrderAt: null,
    });
  });
});
