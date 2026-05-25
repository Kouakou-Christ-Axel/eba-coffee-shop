// lib/stats.ts
//
// Stats agrégées pour la vue d'ensemble admin.
// Calcule sur la base du dailyDate (jour civil local Abidjan).

import prisma from '@/lib/prisma';
import type { OrderType, PaymentMode } from '@/generated/prisma/client';
import { todayDailyDate } from '@/lib/daily-numbering';

export type DailyStats = {
  date: Date;
  totalOrders: number;
  activeOrders: number; // NEW + PREPARING + READY
  completedOrders: number;
  cancelledOrders: number;
  paidOrders: number;
  revenue: number; // somme des totals où isPaid=true
  countByOrderType: Record<OrderType, number>;
  countByPaymentMode: Record<PaymentMode, number>;
  revenueByPaymentMode: Record<PaymentMode, number>;
};

export async function getDailyStats(
  date: Date = todayDailyDate()
): Promise<DailyStats> {
  const orders = await prisma.order.findMany({
    where: { dailyDate: date },
    select: {
      status: true,
      orderType: true,
      isPaid: true,
      paymentMode: true,
      total: true,
    },
  });

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

    if (o.isPaid) {
      stats.paidOrders++;
      stats.revenue += o.total;
      if (o.paymentMode) {
        stats.countByPaymentMode[o.paymentMode]++;
        stats.revenueByPaymentMode[o.paymentMode] += o.total;
      }
    }
  }

  return stats;
}
