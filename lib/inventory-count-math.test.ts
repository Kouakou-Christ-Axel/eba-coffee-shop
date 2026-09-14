import { describe, expect, it } from 'vitest';

import {
  computeCountLines,
  earliestPreviousDate,
  latestPreviousByItem,
  type PreviousCountLine,
  type PurchaseRow,
} from './inventory-count-math';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function previous(
  itemId: string,
  iso: string,
  countedQuantity: number,
  sequence = 0
): PreviousCountLine {
  return { itemId, countDate: d(iso), countedQuantity, sequence };
}

function purchase(
  itemId: string,
  iso: string,
  quantity: number,
  canceled = false
): PurchaseRow {
  return { itemId, date: d(iso), quantity, canceled };
}

describe('computeCountLines', () => {
  it('ne déduit aucune consommation au premier comptage', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 12 }],
      previousLines: [],
      purchases: [purchase('cafe', '2026-09-01', 30)],
      avgUnitCostByItem: new Map([['cafe', 4500]]),
    });

    // Le premier comptage sert de base : il n'y a pas de période à solder,
    // même si des achats sont déjà enregistrés.
    expect(line).toEqual({
      itemId: 'cafe',
      openingQuantity: 0,
      purchasesQuantity: 30,
      countedQuantity: 12,
      consumption: 0,
      unitCostSnapshot: 4500,
    });
  });

  it('déduit la consommation des achats intercalés', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 12 }],
      previousLines: [previous('cafe', '2026-08-01', 20)],
      purchases: [
        purchase('cafe', '2026-08-10', 30),
        purchase('cafe', '2026-09-02', 10),
      ],
      avgUnitCostByItem: new Map([['cafe', 4500]]),
    });

    // 20 en stock + 40 achetés − 12 comptés = 48 consommés.
    expect(line.openingQuantity).toBe(20);
    expect(line.purchasesQuantity).toBe(40);
    expect(line.consumption).toBe(48);
  });

  it('exclut les achats d’un lot de réappro annulé', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 12 }],
      previousLines: [previous('cafe', '2026-08-01', 20)],
      purchases: [
        purchase('cafe', '2026-08-10', 30),
        purchase('cafe', '2026-08-11', 100, true),
      ],
      avgUnitCostByItem: new Map([['cafe', 4500]]),
    });

    // Un lot annulé n'est jamais entré en stock.
    expect(line.purchasesQuantity).toBe(30);
    expect(line.consumption).toBe(38);
  });

  it('borne la période : achats du jour du comptage inclus, ceux du comptage précédent exclus', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 5 }],
      previousLines: [previous('cafe', '2026-08-01', 0)],
      purchases: [
        // Le jour du comptage précédent : déjà compté dans les 0 de ce jour-là.
        purchase('cafe', '2026-08-01', 7),
        purchase('cafe', '2026-08-02', 3),
        // Le jour du comptage courant : sur l'étagère au moment où on compte.
        purchase('cafe', '2026-09-14', 4),
        // Après : appartient à la période suivante.
        purchase('cafe', '2026-09-15', 50),
      ],
      avgUnitCostByItem: new Map(),
    });

    expect(line.purchasesQuantity).toBe(7);
    expect(line.consumption).toBe(2);
  });

  it('ignore les achats des autres références', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 1 }],
      previousLines: [previous('cafe', '2026-08-01', 10)],
      purchases: [purchase('lait', '2026-09-01', 999)],
      avgUnitCostByItem: new Map(),
    });

    expect(line.purchasesQuantity).toBe(0);
    expect(line.consumption).toBe(9);
  });

  it('laisse intactes les références non comptées (comptage partiel)', () => {
    const lines = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 12 }],
      previousLines: [
        previous('cafe', '2026-08-01', 20),
        previous('lait', '2026-08-01', 8),
      ],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    // Une seule ligne produite : `lait` n'a pas été compté, son stock ne bouge
    // pas et aucune ligne de registre ne lui est créée.
    expect(lines).toHaveLength(1);
    expect(lines[0].itemId).toBe('cafe');
  });

  it('retient le comptage précédent le plus récent', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 3 }],
      previousLines: [
        previous('cafe', '2026-06-01', 100),
        previous('cafe', '2026-08-01', 20),
        previous('cafe', '2026-07-01', 50),
      ],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    expect(line.openingQuantity).toBe(20);
  });

  it('départage deux comptages du même jour par ordre de création', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 3 }],
      previousLines: [
        previous('cafe', '2026-08-01', 20, 0),
        previous('cafe', '2026-08-01', 7, 1),
      ],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    // Le correctif enregistré en second fait foi.
    expect(line.openingQuantity).toBe(7);
  });

  it('ignore un comptage à la même date que celui en cours', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 3 }],
      previousLines: [previous('cafe', '2026-09-14', 99)],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    // Strictement antérieur : un comptage du jour même n'ouvre pas la période.
    expect(line.openingQuantity).toBe(0);
    expect(line.consumption).toBe(0);
  });

  it('retombe sur un PMP nul quand la référence n’en a pas', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'cafe', countedQuantity: 3 }],
      previousLines: [],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    expect(line.unitCostSnapshot).toBe(0);
  });

  it('préserve l’ordre des saisies', () => {
    const lines = computeCountLines({
      date: d('2026-09-14'),
      lines: [
        { itemId: 'sucre', countedQuantity: 1 },
        { itemId: 'cafe', countedQuantity: 2 },
        { itemId: 'lait', countedQuantity: 3 },
      ],
      previousLines: [],
      purchases: [],
      avgUnitCostByItem: new Map(),
    });

    expect(lines.map((l) => l.itemId)).toEqual(['sucre', 'cafe', 'lait']);
  });

  it('accepte les quantités fractionnaires', () => {
    const [line] = computeCountLines({
      date: d('2026-09-14'),
      lines: [{ itemId: 'alcool', countedQuantity: 0.02 }],
      previousLines: [previous('alcool', '2026-08-01', 1.5)],
      purchases: [purchase('alcool', '2026-08-15', 0.25)],
      avgUnitCostByItem: new Map(),
    });

    expect(line.consumption).toBeCloseTo(1.73, 10);
  });
});

describe('earliestPreviousDate', () => {
  const date = d('2026-09-14');

  it('renvoie le plus ancien comptage précédent', () => {
    const map = latestPreviousByItem(
      [
        previous('cafe', '2026-08-01', 20),
        previous('lait', '2026-07-05', 8),
        previous('sucre', '2026-08-20', 4),
      ],
      date
    );

    expect(earliestPreviousDate(map, ['cafe', 'lait', 'sucre'])).toEqual(
      d('2026-07-05')
    );
  });

  it('renvoie null dès qu’une référence n’a jamais été comptée', () => {
    const map = latestPreviousByItem(
      [previous('cafe', '2026-08-01', 20)],
      date
    );

    // Pas de borne basse possible : il faut tout l'historique d'achats de
    // `lait`, qui n'a aucun comptage antérieur.
    expect(earliestPreviousDate(map, ['cafe', 'lait'])).toBeNull();
  });

  it('renvoie null sur une liste vide de références', () => {
    expect(earliestPreviousDate(new Map(), [])).toBeNull();
  });
});
