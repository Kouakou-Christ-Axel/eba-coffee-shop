// lib/orders/kitchen-group.ts
//
// Part « cuisine » des commandes groupées (cf. `customer-groups.ts`) : ce que la
// cuisine doit savoir d'un client à plusieurs commandes pour les EMBALLER ET
// FAIRE PARTIR ENSEMBLE — lesquelles cuisent encore, lesquelles attendent déjà,
// et à qui demander le livreur (un seul pour tout le groupe).

import type { PreparationOrder } from '@/lib/preparation-queue';
import type { OrderGroup } from './customer-groups';

export type KitchenGroup = OrderGroup<PreparationOrder>;

export type KitchenGroupSummary = {
  total: number;
  /** Encore en cuisine : « Tout prêt » les concerne. */
  cooking: PreparationOrder[];
  /** Déjà prêtes, en attente des autres pour partir ensemble. */
  ready: PreparationOrder[];
  deliveries: PreparationOrder[];
  /** Livraisons dont le livreur n'est pas encore demandé. */
  driverTargets: PreparationOrder[];
};

export function summarizeKitchenGroup(
  group: KitchenGroup
): KitchenGroupSummary {
  const deliveries = group.orders.filter((o) => o.orderType === 'DELIVERY');
  return {
    total: group.orders.length,
    cooking: group.orders.filter((o) => o.status === 'PREPARING'),
    ready: group.orders.filter((o) => o.status === 'READY'),
    deliveries,
    driverTargets: deliveries.filter((o) => !o.driverRequested),
  };
}

/** Les autres commandes du même groupe que `order` (pour « Avec : #017 · #021 »). */
export function groupMates(
  group: KitchenGroup | undefined,
  order: Pick<PreparationOrder, 'id'>
): PreparationOrder[] {
  return group ? group.orders.filter((o) => o.id !== order.id) : [];
}
