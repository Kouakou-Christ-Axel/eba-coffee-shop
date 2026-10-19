import prisma from '@/lib/prisma';
import { withStaffVisible } from '@/lib/orders/visibility';
import type { OrderType, PaymentMode } from '@/generated/prisma/client';
import { todayDailyDate } from '@/lib/daily-numbering';
import { PAYMENT_MODES, emptyModeRecord } from '@/lib/payment-modes';
import { sumAdjustmentsByModeForDay } from '@/lib/revenue-adjustments';
import { sumRefundsByModeForDay, totalOfModes } from '@/lib/refunds/aggregate';

export type DailyStats = {
  date: Date;
  totalOrders: number;
  activeOrders: number; // NEW + PREPARING + READY
  completedOrders: number;
  cancelledOrders: number;
  paidOrders: number;
  revenue: number; // NET : CA brut − remboursements
  grossRevenue: number; // somme des totals où isPaid=true, hors annulées, + régularisations
  refunds: number; // remboursements partis ce jour (commandes encore comptées)
  countByOrderType: Record<OrderType, number>;
  countByPaymentMode: Record<PaymentMode, number>;
  revenueByPaymentMode: Record<PaymentMode, number>; // NET par canal
  grossRevenueByPaymentMode: Record<PaymentMode, number>;
  refundsByPaymentMode: Record<PaymentMode, number>;
};

export async function getDailyStats(
  date: Date = todayDailyDate()
): Promise<DailyStats> {
  const [orders, adjustments, refundsByMode] = await Promise.all([
    prisma.order.findMany({
      where: withStaffVisible({ dailyDate: date }),
      select: {
        id: true,
        status: true,
        orderType: true,
        isPaid: true,
        paymentMode: true,
        total: true,
      },
    }),
    sumAdjustmentsByModeForDay(date),
    sumRefundsByModeForDay(date),
  ]);

  const stats: DailyStats = {
    date,
    totalOrders: orders.length,
    activeOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    paidOrders: 0,
    revenue: 0,
    grossRevenue: 0,
    refunds: 0,
    countByOrderType: { DELIVERY: 0, DINE_IN: 0, TAKEAWAY: 0 },
    countByPaymentMode: emptyModeRecord(),
    revenueByPaymentMode: emptyModeRecord(),
    grossRevenueByPaymentMode: emptyModeRecord(),
    refundsByPaymentMode: refundsByMode,
  };

  const paidOrderIds: string[] = [];

  for (const o of orders) {
    stats.countByOrderType[o.orderType]++;

    if (o.status === 'COMPLETED') stats.completedOrders++;
    else if (o.status === 'CANCELLED') stats.cancelledOrders++;
    else stats.activeOrders++;

    if (o.isPaid && o.status !== 'CANCELLED') {
      stats.paidOrders++;
      stats.grossRevenue += o.total;
      paidOrderIds.push(o.id);
      if (o.paymentMode) {
        stats.countByPaymentMode[o.paymentMode]++;
      }
    }
  }

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

  // Régularisations de recette : ajoutées au CA (et par mode), sans toucher les
  // compteurs de commandes.
  for (const mode of PAYMENT_MODES) {
    stats.grossRevenue += adjustments[mode];
    stats.grossRevenueByPaymentMode[mode] += adjustments[mode];
  }

  // Remboursements : déduits du CA et du canal par lequel l'argent est sorti. Le
  // brut par canal reste exposé (clôture de caisse : les espèces VENDUES).
  stats.refunds = totalOfModes(refundsByMode);
  stats.revenue = stats.grossRevenue - stats.refunds;
  for (const mode of PAYMENT_MODES) {
    stats.revenueByPaymentMode[mode] =
      stats.grossRevenueByPaymentMode[mode] - refundsByMode[mode];
  }

  return stats;
}
