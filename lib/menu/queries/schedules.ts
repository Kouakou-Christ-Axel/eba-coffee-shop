import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';

export type ProductScheduleRow = {
  id: string;
  name: string;
  days: number[];
  productCount: number;
  categoryCount: number;
};

export async function listProductSchedules(): Promise<ProductScheduleRow[]> {
  const schedules = await prisma.productSchedule.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { products: true, categories: true } },
    },
  });

  return schedules.map((s) => ({
    id: s.id,
    name: s.name,
    days: s.days,
    productCount: s._count.products,
    categoryCount: s._count.categories,
  }));
}

export type ProductWeeklySpecialRow = {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

export async function listProductWeeklySpecials(
  productId: string
): Promise<ProductWeeklySpecialRow[]> {
  const rows = await prisma.productWeeklySpecial.findMany({
    where: { productId },
    orderBy: { startDate: 'desc' },
  });

  return rows.map((w) => ({
    id: w.id,
    startDate: formatLocalDateOnly(w.startDate),
    endDate: formatLocalDateOnly(w.endDate),
    note: w.note,
  }));
}
