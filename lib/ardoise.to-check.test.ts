import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn() } },
}));

import { fetchArdoise } from './ardoise';
import {
  mockFindMany,
  row,
  AWA,
  KOFFI,
  lastBranches,
} from './ardoise.test-utils';

describe('fetchArdoise — à vérifier (hors total)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('une commande READY impayée ancienne n’entre pas dans le total mais figure dans toCheck', async () => {
    // Le « c'est récupéré » a probablement été oublié : on la montre pour ne
    // pas sous-évaluer la dette en silence, sans l'additionner pour autant.
    mockFindMany.mockResolvedValue([
      row({
        id: 'oubliee',
        createdAt: new Date('2026-08-01T10:00:00Z'),
        status: 'READY',
        total: 3000,
        customer: AWA,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.groups).toEqual([]);
    expect(result.totalOwed).toBe(0);
    expect(result.ordersCount).toBe(0);
    expect(result.toCheck.map((o) => o.id)).toEqual(['oubliee']);
    expect(result.toCheckCount).toBe(1);
    expect(result.toCheckTotal).toBe(3000);
  });

  it('une commande NEW ou PREPARING récente n’est ni dette ni anomalie', async () => {
    // Elle n'est même pas renvoyée : la branche « à vérifier » exige
    // `createdAt < minuit`, donc le service du jour ne remonte pas.
    mockFindMany.mockResolvedValue([] as never);

    const result = await fetchArdoise();

    const [, toCheck] = lastBranches();
    expect(toCheck.createdAt).toHaveProperty('lt');
    expect(result.groups).toEqual([]);
    expect(result.toCheck).toEqual([]);
  });

  it('toCheck expose le client et reste trié du plus ancien au plus récent', async () => {
    mockFindMany.mockResolvedValue([
      row({
        id: 'vieille',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        status: 'NEW',
        total: 500,
        customer: KOFFI,
      }),
      row({
        id: 'moins-vieille',
        createdAt: new Date('2026-08-02T10:00:00Z'),
        status: 'PREPARING',
        total: 800,
        customerName: 'Dame au foulard',
        customerPhone: '+2250102030405',
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.toCheck.map((o) => o.id)).toEqual([
      'vieille',
      'moins-vieille',
    ]);
    expect(result.toCheck[0].customerId).toBe('cust-koffi');
    expect(result.toCheck[0].name).toBe('Koffi');
    expect(result.toCheck[0].phone).toBe('+2250501020304');
    // Repli sur les champs figés sur la commande sans fiche CRM.
    expect(result.toCheck[1].customerId).toBeNull();
    expect(result.toCheck[1].name).toBe('Dame au foulard');
    expect(result.toCheck[1].phone).toBe('+2250102030405');
    expect(result.toCheck[1].status).toBe('PREPARING');
  });

  it('toCheckTotal n’est jamais additionné à totalOwed', async () => {
    mockFindMany.mockResolvedValue([
      row({
        id: 'dette',
        createdAt: new Date('2026-08-01T10:00:00Z'),
        total: 1200,
        customer: AWA,
      }),
      row({
        id: 'anomalie',
        createdAt: new Date('2026-08-02T10:00:00Z'),
        status: 'READY',
        total: 9000,
        customer: AWA,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.totalOwed).toBe(1200);
    expect(result.ordersCount).toBe(1);
    expect(result.toCheckTotal).toBe(9000);
    // Le groupe d'Awa ne contient que sa dette réelle.
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].totalOwed).toBe(1200);
    expect(result.groups[0].orders.map((o) => o.id)).toEqual(['dette']);
  });
});
