'use client';

import { useMemo } from 'react';
import type { CashierOrder } from '@/lib/cashier-queue';
import { getUrgencyLevel, type TabKey, type UrgencyLevel } from '../urgency';

const URGENCY_ORDER: UrgencyLevel[] = [
  'normal',
  'attention',
  'alert',
  'critical',
];

function maxUrgency(
  order: CashierOrder,
  now: Date
): { level: UrgencyLevel; tabs: TabKey[] } {
  const tabs: TabKey[] = [];
  // Une commande non payée reste « à encaisser » même après récupération
  // (status COMPLETED) : sinon elle disparaît sans avoir été encaissée.
  if (!order.isPaid && order.status !== 'CANCELLED') {
    tabs.push('to-pay');
  }
  if (order.status === 'PREPARING') tabs.push('in-progress');
  if (order.status === 'READY') tabs.push('ready');

  if (tabs.length === 0) return { level: 'normal', tabs };

  let max: UrgencyLevel = 'normal';
  for (const t of tabs) {
    const lvl = getUrgencyLevel(order, t, now);
    if (URGENCY_ORDER.indexOf(lvl) > URGENCY_ORDER.indexOf(max)) max = lvl;
  }
  return { level: max, tabs };
}

export type UrgencyIndex = Map<string, { level: UrgencyLevel; tabs: TabKey[] }>;
export type UrgencyCounts = Record<TabKey, { total: number; critical: number }>;

/**
 * Calcule, pour chaque commande, son niveau d'urgence max et la liste des tabs
 * dans lesquels elle apparaît. Et agrège ces résultats en compteurs par tab.
 */
export function useUrgencyCounts(
  orders: CashierOrder[],
  now: Date
): {
  urgencyIndex: UrgencyIndex;
  counts: UrgencyCounts;
} {
  const urgencyIndex = useMemo(() => {
    const map: UrgencyIndex = new Map();
    for (const o of orders) {
      map.set(o.id, maxUrgency(o, now));
    }
    return map;
  }, [orders, now]);

  const counts = useMemo(() => {
    const result: UrgencyCounts = {
      'to-pay': { total: 0, critical: 0 },
      'in-progress': { total: 0, critical: 0 },
      ready: { total: 0, critical: 0 },
    };
    for (const o of orders) {
      const tabs = urgencyIndex.get(o.id)?.tabs ?? [];
      for (const t of tabs) {
        result[t].total += 1;
        const lvl = getUrgencyLevel(o, t, now);
        if (lvl === 'critical') result[t].critical += 1;
      }
    }
    return result;
  }, [orders, urgencyIndex, now]);

  return { urgencyIndex, counts };
}

export function filterByTab(
  orders: CashierOrder[],
  tab: TabKey
): CashierOrder[] {
  switch (tab) {
    case 'to-pay':
      // Inclut les commandes récupérées (COMPLETED) mais pas encore encaissées.
      return orders.filter((o) => !o.isPaid && o.status !== 'CANCELLED');
    case 'in-progress':
      return orders.filter((o) => o.status === 'PREPARING');
    case 'ready':
      return orders.filter((o) => o.status === 'READY');
  }
}
