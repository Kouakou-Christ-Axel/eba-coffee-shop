// lib/orders/customer-groups.ts
//
// Commandes groupées : un même client qui commande plusieurs fois (souvent
// récupérées par UN SEUL livreur) voit ses commandes regroupées, en caisse
// comme en cuisine, pour être préparées, envoyées et remises ensemble. Pur,
// côté client, générique : la caisse (`CashierOrder`) et la cuisine
// (`PreparationOrder`) ont chacune leur type, seul ce socle les unit.
//
// Le groupe n'est PAS stocké : il est dérivé de la file à chaque rendu. Chaque
// commande garde son statut et son paiement ; le groupe n'ajoute que des
// actions en lot, qui rappellent les mutations existantes.

import type { OrderStatus } from '@/generated/prisma/client';
import { normalizeIvorianPhone } from '@/lib/phone';
import { isDeferredPickup } from '@/lib/orders/scheduling';

/** Le strict nécessaire pour grouper : commun à `CashierOrder` et `PreparationOrder`. */
export type GroupableOrder = {
  id: string;
  dailyNumber: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  isPaid: boolean;
  pickupTime: Date | null;
  createdAt: Date;
};

/**
 * Clé téléphone via le normaliseur ivoirien du dépôt (`lib/phone.ts`) :
 * « +225 07 12 34 56 78 », « 00225 0712345678 » et « 07 12 34 56 78 » donnent la
 * même clé. Un numéro invalide ne sert pas de clé (pas de fusion hasardeuse).
 */
export function normalizePhoneKey(phone: string | null): string | null {
  if (!phone) return null;
  return normalizeIvorianPhone(phone);
}

/** `customerId` d'abord (fiable), sinon téléphone normalisé ; null = client anonyme, jamais groupé. */
export function customerGroupKey(
  order: Pick<GroupableOrder, 'customerId' | 'customerPhone'>
): string | null {
  if (order.customerId) return `c:${order.customerId}`;
  const phone = normalizePhoneKey(order.customerPhone);
  return phone ? `p:${phone}` : null;
}

/**
 * Une commande entre dans un groupe tant qu'il reste quelque chose à faire
 * pour elle aujourd'hui. Sont exclues : l'annulée, la récupérée ET payée, et la
 * différée (autre jour civil : un groupe ne mélange pas deux jours).
 */
function isGroupable(order: GroupableOrder, now: Date): boolean {
  if (order.status === 'CANCELLED') return false;
  if (order.status === 'COMPLETED' && order.isPaid) return false;
  return !isDeferredPickup(order.pickupTime, now);
}

export type OrderGroup<T extends GroupableOrder = GroupableOrder> = {
  key: string;
  customerName: string | null;
  customerPhone: string | null;
  /** Toutes les commandes du groupe, quel que soit l'onglet, de la plus ancienne à la plus récente. */
  orders: T[];
};

/** Groupes de 2 commandes ou plus, indexés par clé client. */
export function buildCustomerGroups<T extends GroupableOrder>(
  queue: T[],
  now: Date
): Map<string, OrderGroup<T>> {
  const byKey = new Map<string, T[]>();
  for (const order of queue) {
    if (!isGroupable(order, now)) continue;
    const key = customerGroupKey(order);
    if (!key) continue;
    const list = byKey.get(key);
    if (list) list.push(order);
    else byKey.set(key, [order]);
  }
  const groups = new Map<string, OrderGroup<T>>();
  for (const [key, orders] of byKey) {
    if (orders.length < 2) continue;
    orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    groups.set(key, {
      key,
      customerName: orders.find((o) => o.customerName)?.customerName ?? null,
      customerPhone: orders.find((o) => o.customerPhone)?.customerPhone ?? null,
      orders,
    });
  }
  return groups;
}

export type QueueEntry<T extends GroupableOrder> =
  | { kind: 'single'; order: T }
  | { kind: 'group'; group: OrderGroup<T>; inTab: T[] };

/**
 * Transforme la liste d'un onglet en entrées d'affichage : un groupe prend la
 * place de sa PREMIÈRE commande dans l'onglet (l'ordre de la file est gardé),
 * et ne montre que les membres de cet onglet. Un groupe dont un seul membre est
 * dans l'onglet reste un groupe : l'en-tête signale les frères ailleurs.
 */
export function buildQueueEntries<T extends GroupableOrder>(
  tabOrders: T[],
  groups: Map<string, OrderGroup<T>>
): QueueEntry<T>[] {
  const entries: QueueEntry<T>[] = [];
  const placed = new Map<string, T[]>();
  for (const order of tabOrders) {
    const key = customerGroupKey(order);
    const group = key ? groups.get(key) : undefined;
    // Le membre doit réellement appartenir au groupe (une récupérée payée n'y est pas).
    if (!group || !group.orders.some((o) => o.id === order.id)) {
      entries.push({ kind: 'single', order });
      continue;
    }
    const inTab = placed.get(group.key);
    if (inTab) {
      inTab.push(order);
      continue;
    }
    const first = [order];
    placed.set(group.key, first);
    entries.push({ kind: 'group', group, inTab: first });
  }
  return entries;
}

export const orderRef = (o: Pick<GroupableOrder, 'dailyNumber'>) =>
  `#${String(o.dailyNumber).padStart(3, '0')}`;
