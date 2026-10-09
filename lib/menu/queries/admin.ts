import prisma from '@/lib/prisma';
import { formatLocalDateOnly } from '@/lib/timezone';
import {
  intersectAvailableDays,
  effectiveAdvanceOrderDays,
  globalSupplementGroupsInclude,
} from './helpers';

export type AdminMenuSupplementOption = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stockQuantity: number | null;
};

export type AdminMenuSupplementGroup = {
  name: string;
  type: 'single' | 'multiple' | 'quantity';
  required: boolean;
  available: boolean;
  minSelect: number | null;
  maxSelect: number | null;
  options: AdminMenuSupplementOption[];
  isGlobal?: boolean;
};

export type AdminMenuWeeklySpecial = {
  id: string;
  startDate: string;
  endDate: string;
  note: string | null;
};

export type AdminMenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  coutMatiere: number;
  coutEmballage: number;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
  sortOrder: number;
  stockQuantity: number | null;
  unavailableUntil: Date | null;
  // Planning récurrent assigné (voir ProductSchedule) et jours effectifs
  // (intersection avec celui de la catégorie, cf. `intersectAvailableDays`).
  scheduleId: string | null;
  scheduleName: string | null;
  availableDays: number[];
  advanceOrderDays: number | null;
  effectiveAdvanceOrderDays: number | null;
  // Commande spéciale sur mesure (ex. gâteau grand format) : exige un acompte
  // minimum au checkout — voir `Product.requiresDeposit`, prisma/schema.prisma.
  requiresDeposit: boolean;
  weeklySpecials: AdminMenuWeeklySpecial[];
  supplements: AdminMenuSupplementGroup[];
};

export type AdminMenuCategory = {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  sortOrder: number;
  scheduleId: string | null;
  scheduleName: string | null;
  availableDays: number[];
  // Délai de commande à l'avance propre à la catégorie (brut, voir
  // `MenuCategory.advanceOrderDays`).
  advanceOrderDays: number | null;
  products: AdminMenuProduct[];
};

export async function getMenuAdmin(): Promise<AdminMenuCategory[]> {
  const [categories, globalGroups] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        schedule: { select: { id: true, name: true, days: true } },
        products: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            schedule: { select: { id: true, name: true, days: true } },
            weeklySpecials: { orderBy: { startDate: 'desc' } },
            supplementGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    }),
    prisma.supplementGroup.findMany(globalSupplementGroupsInclude),
  ]);

  const adminGlobalGroups: AdminMenuSupplementGroup[] = globalGroups.map(
    (g) => ({
      name: g.name,
      type: g.type as 'single' | 'multiple' | 'quantity',
      required: g.required,
      available: g.available,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      isGlobal: true,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        available: o.available,
        stockQuantity: o.stockQuantity,
      })),
    })
  );

  return categories.map((cat) => {
    const categoryDays = cat.schedule?.days ?? null;
    const categoryAdvanceOrderDays = cat.advanceOrderDays ?? null;
    return {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      available: cat.available,
      sortOrder: cat.sortOrder,
      scheduleId: cat.scheduleId,
      scheduleName: cat.schedule?.name ?? null,
      availableDays: categoryDays ?? [],
      advanceOrderDays: categoryAdvanceOrderDays,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        coutMatiere: p.coutMatiere,
        coutEmballage: p.coutEmballage,
        imageUrl: p.imageUrl ?? null,
        available: p.available,
        featured: p.featured,
        featuredOrder: p.featuredOrder,
        featuredBadge: p.featuredBadge ?? null,
        sortOrder: p.sortOrder,
        stockQuantity: p.stockQuantity,
        unavailableUntil: p.unavailableUntil,
        scheduleId: p.scheduleId,
        scheduleName: p.schedule?.name ?? null,
        availableDays:
          intersectAvailableDays(p.schedule?.days ?? null, categoryDays) ?? [],
        advanceOrderDays: p.advanceOrderDays,
        effectiveAdvanceOrderDays: effectiveAdvanceOrderDays(
          p.advanceOrderDays ?? null,
          categoryAdvanceOrderDays
        ),
        requiresDeposit: p.requiresDeposit,
        weeklySpecials: p.weeklySpecials.map((w) => ({
          id: w.id,
          startDate: formatLocalDateOnly(w.startDate),
          endDate: formatLocalDateOnly(w.endDate),
          note: w.note,
        })),
        supplements: [
          ...p.supplementGroups.map((g) => ({
            name: g.name,
            type: g.type as 'single' | 'multiple' | 'quantity',
            required: g.required,
            available: g.available,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            options: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              price: o.price,
              available: o.available,
              stockQuantity: o.stockQuantity,
            })),
          })),
          ...adminGlobalGroups,
        ],
      })),
    };
  });
}
