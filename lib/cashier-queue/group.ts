// lib/cashier-queue/group.ts
//
// Part « caisse » des commandes groupées (cf. `lib/orders/customer-groups.ts`
// pour le regroupement lui-même) : reste à encaisser, acompte, résumé d'étape
// du groupe et répartition d'un paiement saisi une fois sur chaque commande.

import type { PaymentMode } from '@/generated/prisma/client';
import type { OrderGroup } from '@/lib/orders/customer-groups';
import type { CashierOrder } from './types';

export type CashierGroup = OrderGroup<CashierOrder>;

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

export function summarizeGroup(group: CashierGroup): GroupSummary {
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

export type GroupFocusTab = 'to-pay' | 'in-progress' | 'ready';

/**
 * Onglet dont les actions de groupe s'appliquent quand le groupe est affiché HORS
 * onglet (résultats de recherche) : la prochaine étape du groupe — encaisser s'il
 * reste de l'impayé, sinon finir la cuisine, sinon remettre.
 */
export function groupFocusTab(summary: GroupSummary): GroupFocusTab {
  if (summary.payable.length > 0) return 'to-pay';
  if (summary.preparing.length > 0) return 'in-progress';
  return 'ready';
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
