import prisma from '@/lib/prisma';
import { withStaffVisible } from '@/lib/orders/visibility';
import type { CartItemInput } from '@/lib/schemas/order';
import { getSupplementsPrice } from '@/lib/supplements';

export type TopProduct = {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
};

/** Top produits sur une plage, agrégé depuis le JSON `items` (non agrégeable en SQL). */
export async function getTopProducts(
  from: Date,
  to: Date,
  limit = 8
): Promise<TopProduct[]> {
  const rows = await prisma.order.findMany({
    where: withStaffVisible({
      dailyDate: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    }),
    select: { items: true },
  });

  const agg = new Map<string, TopProduct>();
  for (const r of rows) {
    const items = (r.items as unknown as CartItemInput[]) ?? [];
    for (const it of items) {
      const suppl = getSupplementsPrice(it.supplements);
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
