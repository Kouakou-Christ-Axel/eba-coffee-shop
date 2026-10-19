import prisma from '@/lib/prisma';
import { withStaffVisible } from '@/lib/orders/visibility';
import { formatLocalDateOnly } from '@/lib/timezone';
import { sumAdjustmentsByDay } from '@/lib/revenue-adjustments';
import { sumRefundsByDay } from '@/lib/refunds/aggregate';

export type DailyPoint = {
  date: string;
  orders: number;
  /** NET : CA brut − remboursements du jour. */
  revenue: number;
  grossRevenue: number;
  refunds: number;
};

/** Série temporelle jour par jour (jours manquants remplis à 0). */
export async function getDailySeries(
  from: Date,
  to: Date
): Promise<DailyPoint[]> {
  const [rows, adjByDay, refundsByDay] = await Promise.all([
    prisma.order.findMany({
      where: withStaffVisible({ dailyDate: { gte: from, lte: to } }),
      select: { dailyDate: true, total: true, isPaid: true, status: true },
    }),
    sumAdjustmentsByDay(from, to),
    sumRefundsByDay(from, to),
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
    const grossRevenue = point.revenue + (adjByDay.get(key) ?? 0);
    const refunds = refundsByDay.get(key) ?? 0;
    series.push({
      date: key,
      orders: point.orders,
      revenue: grossRevenue - refunds,
      grossRevenue,
      refunds,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}
