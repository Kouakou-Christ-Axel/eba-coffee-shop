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
  lastWhere,
  lastBranches,
} from './ardoise.test-utils';

describe('fetchArdoise — dette (récupérées et impayées)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regroupe par client, somme le total dû et compte les commandes', async () => {
    mockFindMany.mockResolvedValue([
      row({
        id: 'o1',
        createdAt: new Date('2026-08-01T10:00:00Z'),
        total: 1500,
        customer: AWA,
      }),
      row({
        id: 'o2',
        createdAt: new Date('2026-08-02T10:00:00Z'),
        total: 2500,
        customer: AWA,
      }),
      row({
        id: 'o3',
        createdAt: new Date('2026-08-03T10:00:00Z'),
        total: 1000,
        customer: KOFFI,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.groups).toHaveLength(2);
    const awa = result.groups[0];
    expect(awa.customerId).toBe('cust-awa');
    expect(awa.name).toBe('Awa');
    expect(awa.isTrusted).toBe(true);
    expect(awa.ordersCount).toBe(2);
    expect(awa.totalOwed).toBe(4000);
    expect(awa.oldestUnpaidAt).toEqual(new Date('2026-08-01T10:00:00Z'));
    expect(awa.orders.map((o) => o.id)).toEqual(['o1', 'o2']);

    expect(result.totalOwed).toBe(5000);
    expect(result.ordersCount).toBe(3);
  });

  it('trie les groupes par dette la plus ancienne d’abord', async () => {
    mockFindMany.mockResolvedValue([
      row({
        id: 'recent',
        createdAt: new Date('2026-08-03T10:00:00Z'),
        customer: KOFFI,
      }),
      row({
        id: 'ancienne',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        customer: AWA,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.groups.map((g) => g.customerId)).toEqual([
      'cust-awa',
      'cust-koffi',
    ]);
  });

  it('ne fusionne jamais deux commandes anonymes (une clé par commande)', async () => {
    // Rien ne dit que c'est la même personne : les additionner inventerait une
    // dette.
    mockFindMany.mockResolvedValue([
      row({
        id: 'a1',
        createdAt: new Date('2026-08-01T10:00:00Z'),
        total: 700,
        customerName: 'Monsieur au chapeau',
      }),
      row({
        id: 'a2',
        createdAt: new Date('2026-08-02T10:00:00Z'),
        total: 300,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.groups).toHaveLength(2);
    expect(result.groups.map((g) => g.customerId)).toEqual([null, null]);
    // Le nom figé sur la commande sert de repli quand il n'y a pas de fiche CRM.
    expect(result.groups[0].name).toBe('Monsieur au chapeau');
    expect(result.groups[0].isTrusted).toBe(false);
    expect(result.totalOwed).toBe(1000);
  });

  it('une commande récupérée impayée du jour compte immédiatement', async () => {
    // Le client est sorti ce matin sans payer : c'est une dette tout de suite,
    // pas demain. C'est exactement ce que la suppression de la borne achète.
    mockFindMany.mockResolvedValue([
      row({
        id: 'ce-matin',
        createdAt: new Date(),
        total: 2000,
        customer: AWA,
      }),
    ] as never);

    const result = await fetchArdoise();

    expect(result.totalOwed).toBe(2000);
    expect(result.ordersCount).toBe(1);
    expect(result.groups[0].orders.map((o) => o.id)).toEqual(['ce-matin']);
    expect(result.toCheck).toEqual([]);
  });

  it('une commande récupérée et payée, comme une annulée, n’apparaît nulle part', async () => {
    // Elles sont exclues côté SQL (`isPaid: false`, et `CANCELLED` absent des
    // deux branches du `OR`) : Prisma ne les renvoie donc jamais.
    mockFindMany.mockResolvedValue([] as never);

    const result = await fetchArdoise();

    expect(lastWhere().isPaid).toBe(false);
    const [debt, toCheck] = lastBranches();
    expect(debt.status).toBe('COMPLETED');
    expect(toCheck.status).toEqual({ in: ['NEW', 'PREPARING', 'READY'] });
    expect(result.groups).toEqual([]);
    expect(result.toCheck).toEqual([]);
  });

  it('renvoie une ardoise vide (et non une erreur) quand tout est réglé', async () => {
    mockFindMany.mockResolvedValue([] as never);

    const result = await fetchArdoise();

    expect(result.groups).toEqual([]);
    expect(result.totalOwed).toBe(0);
    expect(result.ordersCount).toBe(0);
    expect(result.toCheck).toEqual([]);
    expect(result.toCheckCount).toBe(0);
    expect(result.toCheckTotal).toBe(0);
  });
});
