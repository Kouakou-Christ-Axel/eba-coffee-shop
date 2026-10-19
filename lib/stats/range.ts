import prisma from '@/lib/prisma';
import { withStaffVisible } from '@/lib/orders/visibility';
import type {
  OrderStatus,
  OrderType,
  PaymentMode,
} from '@/generated/prisma/client';
import { PAYMENT_MODES, emptyModeRecord } from '@/lib/payment-modes';
import { sumAdjustmentsByMode } from '@/lib/revenue-adjustments';
import { sumRefundsByMode, totalOfModes } from '@/lib/refunds/aggregate';

export const ORDER_STATUSES: OrderStatus[] = [
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
  revenue: number; // NET : CA brut − remboursements
  grossRevenue: number; // CA encaissé (isPaid), hors annulées, + régularisations
  refunds: number; // remboursements partis sur la plage (commandes encore comptées)
  cancelledOrders: number;
  avgBasket: number; // revenue / paidOrders (0 si aucune)
  cancellationRate: number; // 0..1
  countByStatus: Record<OrderStatus, number>;
  countByOrderType: Record<OrderType, number>;
  countByPaymentMode: Record<PaymentMode, number>;
  revenueByPaymentMode: Record<PaymentMode, number>; // NET par canal
  grossRevenueByPaymentMode: Record<PaymentMode, number>;
  refundsByPaymentMode: Record<PaymentMode, number>;
};

/** Agrège les KPIs sur une plage de jours civils (inclusive). */
export async function getRangeStats(from: Date, to: Date): Promise<RangeStats> {
  const [orders, adjustments, refundsByMode] = await Promise.all([
    prisma.order.findMany({
      where: withStaffVisible({ dailyDate: { gte: from, lte: to } }),
      select: {
        id: true,
        status: true,
        orderType: true,
        isPaid: true,
        paymentMode: true,
        total: true,
      },
    }),
    sumAdjustmentsByMode(from, to),
    sumRefundsByMode(from, to),
  ]);

  const stats: RangeStats = {
    from,
    to,
    totalOrders: orders.length,
    paidOrders: 0,
    revenue: 0,
    grossRevenue: 0,
    refunds: 0,
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
    countByPaymentMode: emptyModeRecord(),
    revenueByPaymentMode: emptyModeRecord(),
    grossRevenueByPaymentMode: emptyModeRecord(),
    refundsByPaymentMode: refundsByMode,
  };

  const paidOrderIds: string[] = [];

  for (const o of orders) {
    stats.countByStatus[o.status]++;
    stats.countByOrderType[o.orderType]++;
    if (o.status === 'CANCELLED') stats.cancelledOrders++;

    if (o.isPaid && o.status !== 'CANCELLED') {
      stats.paidOrders++;
      stats.grossRevenue += o.total;
      paidOrderIds.push(o.id);
      if (o.paymentMode) {
        stats.countByPaymentMode[o.paymentMode]++;
      }
    }
  }

  // CA par mode : sommé depuis les lignes `OrderPayment` (paiement fractionné,
  // cf. getDailyStats).
  if (paidOrderIds.length > 0) {
    const paymentSums = await prisma.orderPayment.groupBy({
      by: ['mode'],
      where: { orderId: { in: paidOrderIds } },
      _sum: { amount: true },
    });
    for (const row of paymentSums) {
      stats.grossRevenueByPaymentMode[row.mode] += row._sum.amount ?? 0;
    }
  }

  // Panier moyen : calculé sur le CA DES COMMANDES (avant régularisations et
  // remboursements), car ni l'un ni l'autre n'est une commande.
  stats.avgBasket =
    stats.paidOrders > 0
      ? Math.round(stats.grossRevenue / stats.paidOrders)
      : 0;
  stats.cancellationRate =
    stats.totalOrders > 0 ? stats.cancelledOrders / stats.totalOrders : 0;

  // Régularisations de recette : ajoutées au CA total et par mode de paiement.
  for (const mode of PAYMENT_MODES) {
    stats.grossRevenue += adjustments[mode];
    stats.grossRevenueByPaymentMode[mode] += adjustments[mode];
  }

  // Remboursements : déduits du CA et du canal de sortie (cf. getDailyStats).
  stats.refunds = totalOfModes(refundsByMode);
  stats.revenue = stats.grossRevenue - stats.refunds;
  for (const mode of PAYMENT_MODES) {
    stats.revenueByPaymentMode[mode] =
      stats.grossRevenueByPaymentMode[mode] - refundsByMode[mode];
  }

  return stats;
}

export async function getEarliestOrderDate(): Promise<Date | null> {
  // staff-visibility: exempt — plus ancienne date de commande, sans effet sur les chiffres affichés
  const result = await prisma.order.aggregate({ _min: { dailyDate: true } });
  return result._min.dailyDate ?? null;
}
