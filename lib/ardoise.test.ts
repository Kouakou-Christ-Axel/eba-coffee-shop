// lib/ardoise.test.ts
//
// Prisma est mocké par fichier (même pattern que lib/order-mutations.test.ts) :
// on vérifie le CONTRAT de `fetchArdoise` — la clause `where` envoyée à Prisma
// (c'est elle qui définit la dette : récupérée + impayée, sans borne de date)
// et le regroupement/agrégation fait en JS sur les lignes renvoyées, dont la
// séparation dette / « à vérifier ».
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

/** Ligne par défaut = le cas nominal de l'ardoise : récupérée et impayée. */
function row(over: Partial<Row> & Pick<Row, 'id' | 'createdAt'>): Row {
  return {
    reference: `EBA-${over.id}`,
    dailyNumber: 1,
    status: 'COMPLETED',
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

/** Les deux branches du `OR` : [dette, à vérifier]. */
function lastBranches(): [Record<string, unknown>, Record<string, unknown>] {
  const or = lastWhere().OR as Record<string, unknown>[];
  expect(or).toHaveLength(2);
  return [or[0], or[1]];
}

describe('fetchArdoise — filtres envoyés à Prisma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([] as never);
  });

  it('ne remonte que des commandes impayées', async () => {
    await fetchArdoise();

    expect(lastWhere().isPaid).toBe(false);
  });

  it('la dette ne retient que les commandes récupérées (COMPLETED)', async () => {
    // Une commande encore en cours n'est pas une dette : le client n'a rien
    // emporté, il ne doit rien.
    await fetchArdoise();

    const [debt] = lastBranches();
    expect(debt.status).toBe('COMPLETED');
  });

  it('la dette n’est bornée par aucune date (ni createdAt, ni dailyDate)', async () => {
    // Toute la raison d'être du module : `fetchCashierQueue` perdrait la dette
    // d'hier. Et une commande récupérée impayée du jour est une dette tout de
    // suite, pas demain — d'où l'absence totale de borne.
    await fetchArdoise();

    const [debt] = lastBranches();
    expect(debt).not.toHaveProperty('createdAt');
    expect(debt).not.toHaveProperty('dailyDate');
    expect(lastWhere()).not.toHaveProperty('createdAt');
    expect(lastWhere()).not.toHaveProperty('dailyDate');
  });

  it('n’accepte plus de borne « before » : une seule requête, aucun filtre de date racine', async () => {
    await fetchArdoise();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(lastWhere()).sort()).toEqual(['OR', 'isPaid']);
  });

  it('les commandes annulées ne sont dans aucune des deux branches', async () => {
    await fetchArdoise();

    const [debt, toCheck] = lastBranches();
    expect(debt.status).toBe('COMPLETED');
    expect(toCheck.status).toEqual({ in: ['NEW', 'PREPARING', 'READY'] });
  });

  it('la branche « à vérifier » cible NEW/PREPARING/READY d’avant aujourd’hui', async () => {
    const before = new Date();
    await fetchArdoise();
    const after = new Date();

    const [, toCheck] = lastBranches();
    expect(toCheck.status).toEqual({ in: ['NEW', 'PREPARING', 'READY'] });

    const cutoff = (toCheck.createdAt as { lt: Date }).lt;
    // Minuit du jour courant : antérieur (ou égal) à maintenant, et pas plus
    // vieux que 24 h.
    expect(cutoff.getTime()).toBeLessThanOrEqual(before.getTime());
    expect(after.getTime() - cutoff.getTime()).toBeLessThan(
      25 * 60 * 60 * 1000
    );
  });

  it('ne filtre PAS sur isOnAccount par défaut, mais le fait sur demande', async () => {
    await fetchArdoise();
    expect(lastBranches()[0]).not.toHaveProperty('isOnAccount');

    await fetchArdoise({ onlyOnAccount: true });
    expect(lastBranches()[0].isOnAccount).toBe(true);
  });

  it('onlyOnAccount ne filtre QUE la dette, jamais les anomalies à vérifier', async () => {
    // Un retrait non pointé n'est par définition pas consenti : le masquer
    // viderait le garde-fou de son sens.
    await fetchArdoise({ onlyOnAccount: true });

    const [debt, toCheck] = lastBranches();
    expect(debt.isOnAccount).toBe(true);
    expect(toCheck).not.toHaveProperty('isOnAccount');
    expect(lastWhere()).not.toHaveProperty('isOnAccount');
  });
});

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
