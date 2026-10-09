import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';
import { formatLocalDateOnly } from '@/lib/timezone';
import { intersectAvailableDays, effectiveAdvanceOrderDays } from './helpers';

export async function getMenu(): Promise<MenuCategory[]> {
  const [categories, globalGroups] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { available: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        schedule: { select: { days: true } },
        products: {
          where: { available: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            schedule: { select: { days: true } },
            weeklySpecials: { select: { startDate: true, endDate: true } },
            supplementGroups: {
              where: { available: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: {
                  where: { available: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    }),
    prisma.supplementGroup.findMany({
      where: { isGlobal: true, available: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: { where: { available: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
  ]);

  const publicGlobalGroups = globalGroups
    .filter((g) => g.options.length > 0)
    .map((g) => ({
      name: g.name,
      type: g.type as 'single' | 'multiple' | 'quantity',
      required: g.required,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isGlobal: true,
      options: g.options.map((o) => ({
        name: o.name,
        price: o.price,
        stockQuantity: o.stockQuantity,
        remaining: o.stockQuantity,
        soldOut: o.stockQuantity === 0,
      })),
    }));

  return categories.map((cat) => {
    const categoryDays = cat.schedule?.days ?? null;
    const categoryAdvanceOrderDays = cat.advanceOrderDays ?? null;
    return {
      id: cat.slug,
      name: cat.name,
      availableDays: categoryDays ?? undefined,
      advanceOrderDays: categoryAdvanceOrderDays ?? undefined,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        coutMatiere: p.coutMatiere,
        coutEmballage: p.coutEmballage,
        image: p.imageUrl ?? undefined,
        featured: p.featured,
        featuredOrder: p.featuredOrder,
        featuredBadge: p.featuredBadge ?? undefined,
        stockQuantity: p.stockQuantity,
        remaining: p.stockQuantity,
        soldOut: p.stockQuantity === 0,
        unavailableUntil: p.unavailableUntil
          ? p.unavailableUntil.toISOString()
          : null,
        // Planning effectif = intersection du planning propre au produit et de
        // celui de sa catégorie (voir `intersectAvailableDays`).
        availableDays:
          intersectAvailableDays(p.schedule?.days ?? null, categoryDays) ??
          undefined,
        advanceOrderDays:
          effectiveAdvanceOrderDays(
            p.advanceOrderDays ?? null,
            categoryAdvanceOrderDays
          ) ?? undefined,
        requiresDeposit: p.requiresDeposit || undefined,
        weeklySpecialPeriods: p.weeklySpecials.map((w) => ({
          startDate: formatLocalDateOnly(w.startDate),
          endDate: formatLocalDateOnly(w.endDate),
        })),
        supplements: [
          ...p.supplementGroups
            .filter((g) => g.options.length > 0)
            .map((g) => ({
              name: g.name,
              type: g.type as 'single' | 'multiple' | 'quantity',
              required: g.required,
              minSelect: g.minSelect,
              maxSelect: g.maxSelect,
              options: g.options.map((o) => ({
                name: o.name,
                price: o.price,
                stockQuantity: o.stockQuantity,
                remaining: o.stockQuantity,
                soldOut: o.stockQuantity === 0,
              })),
            })),
          ...publicGlobalGroups,
        ],
      })),
    };
  });
}
