// lib/stats.ts
//
// Stats agrégées pour la vue d'ensemble admin.
// Calcule sur la base du dailyDate (jour civil local Abidjan).

import prisma from '@/lib/prisma';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';
import type { CartItemInput } from '@/lib/schemas/order';
import { todayDailyDate } from '@/lib/daily-numbering';
import { formatLocalDateOnly } from '@/lib/timezone';
import {
  sumAdjustmentsByMode,
  sumAdjustmentsByModeForDay,
  sumAdjustmentsByDay,
} from '@/lib/revenue-adjustments';

// Modes de paiement (pour l'ajout des régularisations de recette au CA).
const PAYMENT_MODES: PaymentMode[] = ['CASH', 'WAVE', 'OTHER'];

export type DailyStats = {
  date: Date;
  totalOrders: number;
  activeOrders: number; // NEW + PREPARING + READY
  completedOrders: number;
  cancelledOrders: number;
  paidOrders: number;
  revenue: number; // somme des totals où isPaid=true, hors commandes annulées
  countByOrderType: Record<OrderType, number>;
  countByPaymentMode: Record<PaymentMode, number>;
  revenueByPaymentMode: Record<PaymentMode, number>;
};

export async function getDailyStats(
  date: Date = todayDailyDate()
): Promise<DailyStats> {
  const [orders, adjustments] = await Promise.all([
    prisma.order.findMany({
      where: { dailyDate: date },
      select: {
        status: true,
        orderType: true,
        isPaid: true,
        paymentMode: true,
        total: true,
      },
    }),
    sumAdjustmentsByModeForDay(date),
  ]);

  const stats: DailyStats = {
    date,
    totalOrders: orders.length,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    paidOrders: 0,
    revenue: 0,
    countByOrderType: { DELIVERY: 0, DINE_IN: 0, TAKEAWAY: 0 },
    countByPaymentMode: { CASH: 0, WAVE: 0, OTHER: 0 },
    revenueByPaymentMode: { CASH: 0, WAVE: 0, OTHER: 0 },
  };

  for (const o of orders) {
    stats.countByOrderType[o.orderType]++;

    if (o.status === 'COMPLETED') stats.completedOrders++;
    else if (o.status === 'CANCELLED') stats.cancelledOrders++;
    else stats.activeOrders++;

    if (o.isPaid && o.status !== 'CANCELLED') {
      stats.paidOrders++;
      stats.revenue += o.total;
      if (o.paymentMode) {
        stats.countByPaymentMode[o.paymentMode]++;
        stats.revenueByPaymentMode[o.paymentMode] += o.total;
      }
    }
  }

  // Régularisations de recette : ajoutées au CA (et par mode), sans toucher les
  // compteurs de commandes.
  for (const mode of PAYMENT_MODES) {
    stats.revenue += adjustments[mode];
    stats.revenueByPaymentMode[mode] += adjustments[mode];
  }

  return stats;
}

// ─── Stats sur une plage de dates (page Statistiques) ─────────────────────────

const ORDER_STATUSES: OrderStatus[] = [
  'NEW',
  'PREPARING',
  'READY',
  'COMPLETED',
  'CANCELLED',
];

export type RangeStats = {
  from: Date;
  to: Date;
  totalOrders: number;
  paidOrders: number;
  revenue: number; // CA encaissé (isPaid), hors commandes annulées
  cancelledOrders: number;
  avgBasket: number; // revenue / paidOrders (0 si aucune)
  cancellationRate: number; // 0..1
  countByStatus: Record<OrderStatus, number>;
  countByOrderType: Record<OrderType, number>;
  countByPaymentMode: Record<PaymentMode, number>;
  revenueByPaymentMode: Record<PaymentMode, number>;
};

/**
 * Agrège les KPIs sur une plage de jours civils (inclusive). Même conventions
 * que `getDailyStats` : `revenue` = somme des totaux encaissés (isPaid), hors
 * commandes annulées.
 */
export async function getRangeStats(from: Date, to: Date): Promise<RangeStats> {
  const [orders, adjustments] = await Promise.all([
    prisma.order.findMany({
      where: { dailyDate: { gte: from, lte: to } },
      select: {
        status: true,
        orderType: true,
        isPaid: true,
        paymentMode: true,
        total: true,
      },
    }),
    sumAdjustmentsByMode(from, to),
  ]);

  const stats: RangeStats = {
    from,
    to,
    totalOrders: orders.length,
    paidOrders: 0,
    revenue: 0,
    cancelledOrders: 0,
    avgBasket: 0,
    cancellationRate: 0,
    countByStatus: {
      NEW: 0,
      PREPARING: 0,
      READY: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    },
    countByOrderType: { DELIVERY: 0, DINE_IN: 0, TAKEAWAY: 0 },
    countByPaymentMode: { CASH: 0, WAVE: 0, OTHER: 0 },
    revenueByPaymentMode: { CASH: 0, WAVE: 0, OTHER: 0 },
  };

  for (const o of orders) {
    stats.countByStatus[o.status]++;
    stats.countByOrderType[o.orderType]++;
    if (o.status === 'CANCELLED') stats.cancelledOrders++;

    if (o.isPaid && o.status !== 'CANCELLED') {
      stats.paidOrders++;
      stats.revenue += o.total;
      if (o.paymentMode) {
        stats.countByPaymentMode[o.paymentMode]++;
        stats.revenueByPaymentMode[o.paymentMode] += o.total;
      }
    }
  }

  // Panier moyen : calculé sur le CA DES COMMANDES (avant régularisations), car
  // une régularisation n'est pas une commande.
  stats.avgBasket =
    stats.paidOrders > 0 ? Math.round(stats.revenue / stats.paidOrders) : 0;
  stats.cancellationRate =
    stats.totalOrders > 0 ? stats.cancelledOrders / stats.totalOrders : 0;

  // Régularisations de recette : ajoutées au CA total et par mode de paiement.
  for (const mode of PAYMENT_MODES) {
    stats.revenue += adjustments[mode];
    stats.revenueByPaymentMode[mode] += adjustments[mode];
  }

  return stats;
}

export type DailyPoint = { date: string; orders: number; revenue: number };

/**
 * Série temporelle jour par jour (jours manquants remplis à 0). `revenue` =
 * CA encaissé du jour, hors commandes annulées. Bornes incluses, attendues à
 * minuit UTC (jour civil).
 */
export async function getDailySeries(
  from: Date,
  to: Date
): Promise<DailyPoint[]> {
  const [rows, adjByDay] = await Promise.all([
    prisma.order.findMany({
      where: { dailyDate: { gte: from, lte: to } },
      select: { dailyDate: true, total: true, isPaid: true, status: true },
    }),
    sumAdjustmentsByDay(from, to),
  ]);

  const agg = new Map<string, { orders: number; revenue: number }>();
  for (const r of rows) {
    const key = formatLocalDateOnly(r.dailyDate);
    const cur = agg.get(key) ?? { orders: 0, revenue: 0 };
    cur.orders++;
    if (r.isPaid && r.status !== 'CANCELLED') cur.revenue += r.total;
    agg.set(key, cur);
  }

  const series: DailyPoint[] = [];
  const cursor = new Date(from.getTime());
  while (cursor.getTime() <= to.getTime()) {
    const key = formatLocalDateOnly(cursor);
    const point = agg.get(key) ?? { orders: 0, revenue: 0 };
    // Régularisations du jour ajoutées au CA (le nombre de commandes reste tel quel).
    const revenue = point.revenue + (adjByDay.get(key) ?? 0);
    series.push({ date: key, orders: point.orders, revenue });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

export type TopProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

/**
 * Top produits sur une plage, agrégé depuis le JSON `items` (non agrégeable en
 * SQL). Exclut les commandes annulées. `revenue` net de remise par ligne.
 */
export async function getTopProducts(
  from: Date,
  to: Date,
  limit = 8
): Promise<TopProduct[]> {
  const rows = await prisma.order.findMany({
    where: { dailyDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { items: true },
  });

  const agg = new Map<string, TopProduct>();
  for (const r of rows) {
    const items = (r.items as unknown as CartItemInput[]) ?? [];
    for (const it of items) {
      const suppl = it.supplements.reduce((s, x) => s + x.price, 0);
      const lineRevenue =
        (it.basePrice + suppl) * it.quantity - (it.discount ?? 0);
      const cur = agg.get(it.productId) ?? {
        productId: it.productId,
        name: it.productName,
        quantity: 0,
        revenue: 0,
      };
      cur.quantity += it.quantity;
      cur.revenue += lineRevenue;
      agg.set(it.productId, cur);
    }
  }

  return [...agg.values()]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

export { ORDER_STATUSES };
