import { describe, it, expect } from 'vitest';
import {
  compareKitchenFifo,
  kitchenEntryTime,
  type KitchenSortable,
} from './queue-order';

function makeOrder(
  dailyNumber: number,
  createdAt: string,
  preparingStartedAt: string | null
): KitchenSortable {
  return {
    dailyNumber,
    createdAt: new Date(createdAt),
    preparingStartedAt: preparingStartedAt
      ? new Date(preparingStartedAt)
      : null,
  };
}

describe('kitchenEntryTime', () => {
  it('utilise preparingStartedAt quand il est renseigné', () => {
    const o = makeOrder(1, '2026-06-13T10:00:00Z', '2026-06-13T10:10:00Z');
    expect(kitchenEntryTime(o)).toBe(
      new Date('2026-06-13T10:10:00Z').getTime()
    );
  });

  it('retombe sur createdAt quand preparingStartedAt est null', () => {
    const o = makeOrder(1, '2026-06-13T10:00:00Z', null);
    expect(kitchenEntryTime(o)).toBe(
      new Date('2026-06-13T10:00:00Z').getTime()
    );
  });
});

describe('compareKitchenFifo', () => {
  it('classe par entrée en cuisine et non par création (A créée avant, encaissée après B)', () => {
    // Bug historique : A créée 10:00 / payée 10:10, B créée 10:05 / payée 10:06.
    // La cuisine doit voir B en premier — c'est elle qui est entrée en premier.
    const a = makeOrder(1, '2026-06-13T10:00:00Z', '2026-06-13T10:10:00Z');
    const b = makeOrder(2, '2026-06-13T10:05:00Z', '2026-06-13T10:06:00Z');
    expect([a, b].sort(compareKitchenFifo).map((o) => o.dailyNumber)).toEqual([
      2, 1,
    ]);
  });

  it('intercale une ligne legacy (preparingStartedAt null) à son createdAt, sans la reléguer en fin', () => {
    // Une commande sans preparingStartedAt affiche déjà « en cuisine depuis X »
    // calculé depuis createdAt : la trier « nulls last » contredirait son
    // propre minuteur.
    const early = makeOrder(1, '2026-06-13T10:00:00Z', '2026-06-13T10:20:00Z');
    const legacy = makeOrder(2, '2026-06-13T10:10:00Z', null);
    const late = makeOrder(3, '2026-06-13T10:25:00Z', '2026-06-13T10:30:00Z');
    expect(
      [early, legacy, late].sort(compareKitchenFifo).map((o) => o.dailyNumber)
    ).toEqual([2, 1, 3]);
  });

  it('départage par createdAt puis dailyNumber à entrée en cuisine identique', () => {
    const sameEntry = '2026-06-13T10:30:00Z';
    const a = makeOrder(7, '2026-06-13T10:02:00Z', sameEntry);
    const b = makeOrder(3, '2026-06-13T10:05:00Z', sameEntry);
    const c = makeOrder(2, '2026-06-13T10:05:00Z', sameEntry);
    expect(
      [b, c, a].sort(compareKitchenFifo).map((o) => o.dailyNumber)
    ).toEqual([7, 2, 3]);
  });

  it('est déterministe : deux ordres de départ donnent la même sortie', () => {
    // La file est re-triée à chaque tick SSE : elle ne doit jamais « sauter ».
    const orders = [
      makeOrder(4, '2026-06-13T10:05:00Z', '2026-06-13T10:30:00Z'),
      makeOrder(1, '2026-06-13T10:00:00Z', null),
      makeOrder(2, '2026-06-13T10:05:00Z', '2026-06-13T10:30:00Z'),
      makeOrder(3, '2026-06-13T10:01:00Z', '2026-06-13T10:02:00Z'),
    ];
    const asc = [...orders].sort(compareKitchenFifo).map((o) => o.dailyNumber);
    const fromReversed = [...orders]
      .reverse()
      .sort(compareKitchenFifo)
      .map((o) => o.dailyNumber);
    expect(asc).toEqual([1, 3, 2, 4]);
    expect(fromReversed).toEqual(asc);
  });
});
