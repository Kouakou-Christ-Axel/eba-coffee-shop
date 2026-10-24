import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock('@/lib/prisma', () => ({ default: { $queryRaw: queryRaw } }));

import { listCustomers } from './list';

const sqlOf = (call: unknown[]) => (call[0] as { sql: string }).sql;
const valuesOf = (call: unknown[]) => (call[0] as { values: unknown[] }).values;

beforeEach(() => {
  vi.clearAllMocks();
  queryRaw
    .mockResolvedValueOnce([
      { id: 'a', ordersCount: 3, totalSpent: 9000, lastOrderAt: null },
      { id: 'b', ordersCount: 0, totalSpent: 0, lastOrderAt: null },
    ])
    .mockResolvedValueOnce([{ total: 42 }]);
});

describe('listCustomers', () => {
  it('2 requêtes quelle que soit la taille de la page : les lignes et le total', async () => {
    const res = await listCustomers({ search: 'kou', page: 2 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({ total: 42, pageSize: 20 });
    // OFFSET de la page 2.
    expect(valuesOf(queryRaw.mock.calls[0])).toContain(20);
  });

  it('withStats : les chiffres viennent de la MÊME requête (jointure), plus de requête dédiée', async () => {
    const { customers } = await listCustomers({}, { withStats: true });
    expect(queryRaw).toHaveBeenCalledTimes(2);
    const rowsSql = sqlOf(queryRaw.mock.calls[0]);
    expect(rowsSql).toContain('LEFT JOIN');
    expect(rowsSql).toContain('"ordersCount"');
    expect(customers[0].stats).toEqual({
      ordersCount: 3,
      totalSpent: 9000,
      lastOrderAt: null,
    });
    // Les colonnes de stats ne fuient pas dans la fiche.
    expect(customers[0]).not.toHaveProperty('ordersCount');
  });

  it('sans withStats : aucune jointure sur les commandes, stats nulles', async () => {
    const { customers } = await listCustomers({ search: 'kou' });
    expect(sqlOf(queryRaw.mock.calls[0])).not.toContain('"order"');
    expect(customers[0].stats).toBeNull();
  });

  it('un tri sur une stat joint les agrégats même sans les afficher', async () => {
    await listCustomers({ sort: 'totalSpent' });
    expect(sqlOf(queryRaw.mock.calls[0])).toContain('GROUP BY');
    expect(sqlOf(queryRaw.mock.calls[0])).not.toContain('"ordersCount"');
  });

  it('le total ne dépend ni du tri ni de la jointure', async () => {
    await listCustomers({ sort: 'totalSpent' }, { withStats: true });
    expect(sqlOf(queryRaw.mock.calls[1])).not.toContain('"order"');
  });
});
