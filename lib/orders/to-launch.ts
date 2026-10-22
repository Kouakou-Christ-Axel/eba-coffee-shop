// lib/orders/to-launch.ts
//
// Programmées payées dont le retrait tombe AUJOURD'HUI et qui attendent encore
// leur lancement en cuisine. Une seule règle, lue par la cuisine ET la caisse :
//   - `ready`   : tout leur stock est réservé (cf. lib/orders/stock-holds) — il
//                 n'y a plus qu'à les lancer, sans rien décompter de plus ;
//   - `waiting` : au moins une ressource attend encore son stock.
// Les impayées n'entrent pas ici : la caisse décide (ardoise ou encaissement).

import {
  kitchenLaunchState,
  type KitchenLaunchState,
} from '@/lib/orders/scheduling';
import type { StockHoldSummary } from '@/lib/orders/stock-holds/state';

type ToLaunchCandidate = Parameters<typeof kitchenLaunchState>[0] & {
  isPaid: boolean;
  stockHold?: Pick<StockHoldSummary, 'state'>;
};

export type ToLaunchToday<T> = {
  ready: T[];
  waiting: T[];
  /** Une commande prête à lancer a son retrait dans moins de 30 min. */
  urgent: boolean;
  /** Une commande encore en attente de stock a son retrait dans moins de 30 min. */
  lateWaiting: boolean;
};

function pickupMs(o: { pickupTime: Date | null }): number {
  return o.pickupTime?.getTime() ?? 0;
}

export function selectToLaunchToday<T extends ToLaunchCandidate>(
  orders: T[],
  now: Date
): ToLaunchToday<T> {
  const ready: T[] = [];
  const waiting: T[] = [];
  const states = new Map<T, KitchenLaunchState>();

  for (const o of orders) {
    if (!o.isPaid) continue;
    const launch = kitchenLaunchState(o, now);
    if (launch !== 'today' && launch !== 'now') continue;
    states.set(o, launch);
    (o.stockHold?.state === 'full' ? ready : waiting).push(o);
  }
  ready.sort((a, b) => pickupMs(a) - pickupMs(b));
  waiting.sort((a, b) => pickupMs(a) - pickupMs(b));

  return {
    ready,
    waiting,
    urgent: ready.some((o) => states.get(o) === 'now'),
    lateWaiting: waiting.some((o) => states.get(o) === 'now'),
  };
}
