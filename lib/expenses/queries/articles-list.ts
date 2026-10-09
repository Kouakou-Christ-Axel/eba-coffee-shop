import { cache } from 'react';
import prisma from '@/lib/prisma';

/** Articles actifs (autocomplétion / désambiguïsation), triés par nom. */
export const listExpenseArticles = cache(async function listExpenseArticles(
  search?: string
) {
  const q = search?.trim();
  return prisma.expenseArticle.findMany({
    where: {
      archivedAt: null,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      baseUnit: true,
      trackInventory: true,
      inventoryItemId: true,
      location: true,
      bulkPurchase: true,
      wholesaleRefPrice: true,
      _count: { select: { items: true } },
    },
  });
});
