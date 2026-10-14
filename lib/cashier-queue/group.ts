// lib/cashier-queue/group.ts
//
// Commandes groupées de la caisse : un même client qui commande plusieurs fois
// (souvent récupérées par UN SEUL livreur) voit ses commandes regroupées pour
// être encaissées, lancées, envoyées et remises ensemble. Pur, côté client.
//
// Le groupe n'est PAS stocké : il est dérivé de la file à chaque rendu. Chaque
// commande garde son statut et son paiement ; le groupe n'ajoute que des
// actions en lot, qui rappellent les mutations existantes.

import type { PaymentMode } from '@/generated/prisma/client';
import { normalizeIvorianPhone } from '@/lib/phone';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { CashierOrder } from './types';

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
export function customerGroupKey(order: CashierOrder): string | null {
  if (order.customerId) return `c:${order.customerId}`;
  const phone = normalizePhoneKey(order.customerPhone);
  return phone ? `p:${phone}` : null;
}

/**
 * Une commande entre dans un groupe tant qu'il reste quelque chose à faire
 * pour elle aujourd'hui. Sont exclues : l'annulée, la récupérée ET payée, et la
 * différée (autre jour civil : un groupe ne mélange pas deux jours).
 */
function isGroupable(order: CashierOrder, now: Date): boolean {
  if (order.status === 'CANCELLED') return false;
  if (order.status === 'COMPLETED' && order.isPaid) return false;
  return !isDeferredPickup(order.pickupTime, now);
}

export type OrderGroup = {
  key: string;
  customerName: string | null;
  customerPhone: string | null;
  /** Toutes les commandes du groupe, quel que soit l'onglet, de la plus ancienne à la plus récente. */
  orders: CashierOrder[];
};

/** Groupes de 2 commandes ou plus, indexés par clé client. */
export function buildCustomerGroups(
  queue: CashierOrder[],
  now: Date
): Map<string, OrderGroup> {
  const byKey = new Map<string, CashierOrder[]>();
  for (const order of queue) {
    if (!isGroupable(order, now)) continue;
    const key = customerGroupKey(order);
    if (!key) continue;
    const list = byKey.get(key);
    if (list) list.push(order);
    else byKey.set(key, [order]);
  }
  const groups = new Map<string, OrderGroup>();
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

export type QueueEntry =
  | { kind: 'single'; order: CashierOrder }
  | { kind: 'group'; group: OrderGroup; inTab: CashierOrder[] };

/**
 * Transforme la liste d'un onglet en entrées d'affichage : un groupe prend la
 * place de sa PREMIÈRE commande dans l'onglet (l'ordre de la file est gardé),
 * et ne montre que les membres de cet onglet. Un groupe dont un seul membre est
 * dans l'onglet reste un groupe : l'en-tête signale les frères ailleurs.
 */
export function buildQueueEntries(
  tabOrders: CashierOrder[],
  groups: Map<string, OrderGroup>
): QueueEntry[] {
  const entries: QueueEntry[] = [];
  const placed = new Map<string, CashierOrder[]>();
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

export const orderRef = (o: Pick<CashierOrder, 'dailyNumber'>) =>
  `#${String(o.dailyNumber).padStart(3, '0')}`;

/** Reste à encaisser sur une commande (acompte déduit) ; 0 si payée. */
export function remainingToPay(order: CashierOrder): number {
  if (order.isPaid) return 0;
  return Math.max(0, order.total - (order.depositPaid ?? 0));
}

/** Acompte encore dû avant l'entrée en cuisine : ces commandes se traitent une à une. */
export function needsDepositFirst(order: CashierOrder): boolean {
  return (
    !order.isPaid &&
    order.depositRequired != null &&
    order.depositRequired - (order.depositPaid ?? 0) > 0
  );
}

export type GroupSummary = {
  total: number;
  /** Commandes de la file « à encaisser » qu'un « Encaisser tout » peut solder. */
  payable: CashierOrder[];
  /** Impayées mais bloquées par un acompte : à traiter individuellement. */
  blockedByDeposit: CashierOrder[];
  amountToPay: number;
  preparing: CashierOrder[];
  /** Pas encore en cuisine (NEW) : payées d'avance puis lancées, ou à encaisser. */
  notStarted: CashierOrder[];
  ready: CashierOrder[];
  /** Prêtes ET payées : remettables en un geste. */
  handable: CashierOrder[];
  /** Livraisons dont le livreur n'a pas encore été demandé (cuisine ou prêtes). */
  driverTargets: CashierOrder[];
  deliveries: CashierOrder[];
};

export function summarizeGroup(group: OrderGroup): GroupSummary {
  const orders = group.orders;
  const unpaid = orders.filter((o) => !o.isPaid);
  const payable = unpaid.filter((o) => !needsDepositFirst(o));
  const deliveries = orders.filter((o) => o.orderType === 'DELIVERY');
  return {
    total: orders.length,
    payable,
    blockedByDeposit: unpaid.filter(needsDepositFirst),
    amountToPay: payable.reduce((sum, o) => sum + remainingToPay(o), 0),
    preparing: orders.filter((o) => o.status === 'PREPARING'),
    notStarted: orders.filter((o) => o.status === 'NEW'),
    ready: orders.filter((o) => o.status === 'READY'),
    handable: orders.filter((o) => o.status === 'READY' && o.isPaid),
    deliveries,
    driverTargets: deliveries.filter(
      (o) =>
        !o.driverRequested && (o.status === 'PREPARING' || o.status === 'READY')
    ),
  };
}

export type OrderPayments = { orderId: string; payments: PaymentLine[] };
export type PaymentLine = { mode: PaymentMode; amount: number };

/**
 * Répartit les lignes de paiement saisies une fois pour le groupe sur chaque
 * commande (« en cascade » : on solde la première, puis la suivante…). Chaque
 * commande reçoit des lignes dont la somme égale exactement son reste à payer,
 * ce que l'API de paiement exige. Renvoie null si la somme saisie ne couvre
 * pas pile le total.
 */
export function allocatePayments(
  lines: PaymentLine[],
  targets: { orderId: string; amount: number }[]
): OrderPayments[] | null {
  const due = targets.reduce((s, t) => s + t.amount, 0);
  const given = lines.reduce((s, l) => s + l.amount, 0);
  if (due !== given) return null;

  const pool = lines.map((l) => ({ ...l }));
  let cursor = 0;
  return targets.map((t) => {
    let need = t.amount;
    const payments: PaymentLine[] = [];
    while (need > 0 && cursor < pool.length) {
      const line = pool[cursor];
      const take = Math.min(line.amount, need);
      if (take > 0) payments.push({ mode: line.mode, amount: take });
      line.amount -= take;
      need -= take;
      if (line.amount === 0) cursor += 1;
    }
    return { orderId: t.orderId, payments };
  });
}
