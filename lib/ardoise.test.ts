// lib/ardoise.test.ts
//
// Prisma est mocké par fichier (même pattern que lib/order-mutations.test.ts) :
// on vérifie le CONTRAT de `fetchArdoise` — la clause `where` envoyée à Prisma
// (c'est elle qui exclut les annulées, les payées et les commandes du jour) et
// le regroupement/agrégation fait en JS sur les lignes renvoyées.
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from 'vitest';

vi.mock('@/lib/prisma', () => ({
  default: { order: { findMany: vi.fn() } },
}));

import prisma from '@/lib/prisma';
import { fetchArdoise } from './ardoise';

const mockFindMany = prisma.order.findMany as MockedFunction<
  typeof prisma.order.findMany
>;

type Row = {
  id: string;
  reference: string;
  dailyNumber: number;
  status: string;
  total: number;
  isOnAccount: boolean;
  createdAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    isTrusted: boolean;
  } | null;
};

function row(over: Partial<Row> & Pick<Row, 'id' | 'createdAt'>): Row {
  return {
    reference: `EBA-${over.id}`,
    dailyNumber: 1,
    status: 'PREPARING',
    total: 1000,
    isOnAccount: true,
    customerName: null,
    customerPhone: null,
    customer: null,
    ...over,
  } as Row;
}

const AWA = {
  id: 'cust-awa',
  name: 'Awa',
  phone: '+2250708090910',
  isTrusted: true,
};
const KOFFI = {
  id: 'cust-koffi',
  name: 'Koffi',
  phone: '+2250501020304',
  isTrusted: false,
};

/** Clause `where` réellement envoyée à Prisma au dernier appel. */
function lastWhere(): Record<string, unknown> {
  const args = mockFindMany.mock.calls.at(-1)?.[0] as {
    where: Record<string, unknown>;
  };
  return args.where;
}

describe('fetchArdoise — filtres envoyés à Prisma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([] as never);
  });

  it('exclut les commandes payées et les commandes annulées', async () => {
    await fetchArdoise();

    const where = lastWhere();
    expect(where.isPaid).toBe(false);
    expect(where.status).toEqual({ not: 'CANCELLED' });
  });

  it('borne par défaut à minuit du jour en cours (les impayés du jour restent le travail de la caisse)', async () => {
    const before = new Date();
    await fetchArdoise();
    const after = new Date();

    const cutoff = (lastWhere().createdAt as { lt: Date }).lt;
    // Minuit du jour courant : antérieur (ou égal) à maintenant, et pas plus
    // vieux que 24 h.
    expect(cutoff.getTime()).toBeLessThanOrEqual(before.getTime());
    expect(after.getTime() - cutoff.getTime()).toBeLessThan(
      25 * 60 * 60 * 1000
    );
  });

  it('respecte une borne `before` explicite (bouton « inclure aujourd’hui »)', async () => {
    const before = new Date('2026-08-04T23:59:59.000Z');
    const result = await fetchArdoise({ before });

    expect(lastWhere().createdAt).toEqual({ lt: before });
    expect(result.before).toBe(before);
  });

  it('ne filtre PAS sur isOnAccount par défaut, mais le fait sur demande', async () => {
    await fetchArdoise();
    expect(lastWhere()).not.toHaveProperty('isOnAccount');

    await fetchArdoise({ onlyOnAccount: true });
    expect(lastWhere().isOnAccount).toBe(true);
  });

  it('n’est PAS cadrée sur un jour civil (aucun filtre dailyDate)', async () => {
    // C'est toute la raison d'être du module : `fetchCashierQueue` perdrait la
    // dette d'hier.
    await fetchArdoise();
    expect(lastWhere()).not.toHaveProperty('dailyDate');
  });
});

describe('fetchArdoise — regroupement et agrégation', () => {
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

  it('renvoie une ardoise vide (et non une erreur) quand tout est réglé', async () => {
    mockFindMany.mockResolvedValue([] as never);

    const result = await fetchArdoise();

    expect(result.groups).toEqual([]);
    expect(result.totalOwed).toBe(0);
    expect(result.ordersCount).toBe(0);
  });
});
