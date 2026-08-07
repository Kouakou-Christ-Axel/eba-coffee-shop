// lib/menu.ts
import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';
import { formatLocalDateOnly } from '@/lib/timezone';

/**
 * Combine le planning propre d'un produit avec celui de sa catégorie (les deux
 * sont optionnels et indépendants) : le produit n'est disponible que les jours
 * communs aux deux. `null` = pas de restriction de ce côté. Convention : `null`
 * si ni l'un ni l'autre ne restreint, sinon un tableau (MÊME VIDE si les deux
 * plannings n'ont aucun jour en commun — voir `isAvailableToday`,
 * lib/supplements.ts).
 */
function intersectAvailableDays(
  a: number[] | null,
  b: number[] | null
): number[] | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return a.filter((d) => b.includes(d));
}

/**
 * Combine le délai de commande à l'avance du produit et celui de sa
 * catégorie (voir `Product.advanceOrderDays`/`MenuCategory.advanceOrderDays`,
 * prisma/schema.prisma) : le délai EFFECTIF est le plus restrictif des deux
 * (maximum) — contrairement à `intersectAvailableDays`, il n'y a rien à
 * « intersecter » entre deux entiers. `null` = aucune contrainte des deux
 * côtés.
 */
function effectiveAdvanceOrderDays(
  productDays: number | null,
  categoryDays: number | null
): number | null {
  if (productDays == null && categoryDays == null) return null;
  return Math.max(productDays ?? 0, categoryDays ?? 0);
}

// Un groupe « Extras » global (`isGlobal: true`, `productId: null`) est
// configuré une seule fois et proposé sur TOUS les produits, sans avoir à le
// rattacher à chacun individuellement. On le lit à part puis on le fusionne
// dans les `supplements` de chaque produit (voir `getMenu`/`getMenuAdmin`).
const globalSupplementGroupsInclude = {
  where: { isGlobal: true as const },
  orderBy: { sortOrder: 'asc' as const },
  include: { options: true },
};

export async function getMenu(): Promise<MenuCategory[]> {
  const [categories, globalGroups] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { available: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        schedule: { select: { days: true } },
        products: {
          // `available: true` masque un produit désactivé manuellement, mais un
          // produit à stock 0 (épuisé) ou en pause reste visible (champs dérivés
          // `soldOut`/`remaining`/`unavailableUntil` ci-dessous) : le masquage
          // dur reste réservé au drapeau `available`.
          where: { available: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            schedule: { select: { days: true } },
            weeklySpecials: { select: { startDate: true, endDate: true } },
            // Côté client : on n'expose que les groupes et goûts disponibles. Un
            // groupe/goût désactivé reste configuré mais devient non sélectionnable.
            // Un goût épuisé (stock 0), lui, reste inclus (même logique que les
            // produits) : seul `available: false` retire une option de la liste.
            supplementGroups: {
              where: { available: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                options: { where: { available: true } },
              },
            },
          },
        },
      },
    }),
    prisma.supplementGroup.findMany({
      where: { isGlobal: true, available: true },
      orderBy: { sortOrder: 'asc' },
      include: { options: { where: { available: true } } },
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
        // Mise en avant éditoriale : reprise telle quelle côté public pour la
        // vitrine « Les plus commandés » (carte) et la vente additionnelle du
        // panier, en plus de la section « incontournables » de l'accueil.
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
        weeklySpecialPeriods: p.weeklySpecials.map((w) => ({
          startDate: formatLocalDateOnly(w.startDate),
          endDate: formatLocalDateOnly(w.endDate),
        })),
        // Un groupe dont tous les goûts sont désactivés n'a plus d'option : inutile
        // de le présenter, on le retire. Un groupe dont les options sont toutes
        // épuisées (stock 0) reste néanmoins présenté (l'option affiche « épuisé »
        // côté UI) : on ne filtre ici que sur la présence d'options disponibles.
        // Les groupes globaux (« Extras ») sont ajoutés après ceux propres au
        // produit.
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

// ─── Lecture côté administration ────────────────────────────────────────────
//
// `getMenu()` ne renvoie que les éléments visibles (`available: true`) et utilise
// le slug comme identifiant — parfait pour le site public, inutilisable pour la
// gestion. `getMenuAdmin()` expose au contraire les identifiants internes
// (Prisma `id`), les éléments masqués et les drapeaux d'état. C'est la source des
// outils MCP de lecture (`get_menu`) qui ont besoin des `id` pour cibler les
// mutations.

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
  // Groupe « Extras » global (voir config/menu.ts SupplementGroup.isGlobal) —
  // fusionné dans les `supplements` de chaque produit en lecture seule ; sa
  // gestion (CRUD) se fait via `getGlobalExtras`/écran dédié, pas ici.
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
  // Commande à l'avance obligatoire (voir `Product.advanceOrderDays`,
  // prisma/schema.prisma) : `advanceOrderDays` est la valeur BRUTE propre à
  // CE produit (pour le formulaire admin), `effectiveAdvanceOrderDays` le
  // délai réellement appliqué (maximum avec celui de la catégorie — voir
  // `effectiveAdvanceOrderDays`, ce fichier).
  advanceOrderDays: number | null;
  effectiveAdvanceOrderDays: number | null;
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
              include: { options: true },
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

// ─── Extras globaux (admin) ─────────────────────────────────────────────────
//
// Contrairement aux groupes de suppléments d'un produit (gérés en bloc via
// `productUpdateSchema.supplementGroups`, appariés par nom), les groupes
// globaux sont indépendants de tout produit : ils ont leur propre écran admin
// (`app/(dashboard)/dashboard/menu/extras-globaux`) et sont donc adressés par
// leur `id` Prisma directement (voir `lib/global-extras-mutations.ts`).

export type GlobalExtraOption = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  stockQuantity: number | null;
};
export type GlobalExtraGroup = {
  id: string;
  name: string;
  type: 'single' | 'multiple' | 'quantity';
  required: boolean;
  available: boolean;
  sortOrder: number;
  minSelect: number | null;
  maxSelect: number | null;
  options: GlobalExtraOption[];
};

export async function getGlobalExtras(): Promise<GlobalExtraGroup[]> {
  const groups = await prisma.supplementGroup.findMany({
    where: { isGlobal: true },
    orderBy: { sortOrder: 'asc' },
    include: { options: true },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type as 'single' | 'multiple' | 'quantity',
    required: g.required,
    available: g.available,
    sortOrder: g.sortOrder,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price,
      available: o.available,
      stockQuantity: o.stockQuantity,
    })),
  }));
}

// ─── Vue consolidée du stock par option (« goûts ») ─────────────────────────
//
// `products-table.tsx` n'affiche le stock qu'au niveau PRODUIT : pour un
// produit à variantes (ex. plusieurs goûts d'un même gâteau, chacun avec son
// propre `SupplementOption.stockQuantity`), il fallait ouvrir la fiche de
// CHAQUE produit pour voir le stock restant par goût. Cette fonction liste en
// un seul endroit toutes les options à stock SUIVI (`stockQuantity` non nul),
// tous produits/catégories confondus, y compris les extras globaux (sans
// produit). Voir `app/(dashboard)/dashboard/menu/stock-supplements`.

export type OptionStockRow = {
  id: string;
  optionName: string;
  price: number;
  stockQuantity: number | null;
  groupName: string;
  isGlobal: boolean;
  productId: string | null;
  productName: string | null;
  categoryName: string | null;
};

export async function getAllOptionStock(): Promise<OptionStockRow[]> {
  const options = await prisma.supplementOption.findMany({
    where: { stockQuantity: { not: null } },
    include: {
      group: {
        include: {
          product: { include: { category: true } },
        },
      },
    },
  });

  return options
    .map((o) => ({
      id: o.id,
      optionName: o.name,
      price: o.price,
      stockQuantity: o.stockQuantity,
      groupName: o.group.name,
      isGlobal: o.group.isGlobal,
      productId: o.group.product?.id ?? null,
      productName: o.group.product?.name ?? null,
      categoryName: o.group.product?.category.name ?? null,
    }))
    .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
}

// ─── Plannings récurrents (« à la cal.com ») ────────────────────────────────
//
// Un `ProductSchedule` est nommé et réutilisable : assignable à plusieurs
// produits ET catégories à la fois (voir `Product.scheduleId`/
// `MenuCategory.scheduleId`, prisma/schema.prisma). Modifier le planning met
// à jour tout ce qui l'utilise. Écran dédié :
// `app/(dashboard)/dashboard/menu/plannings`.

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

// ─── Spécialité de la semaine — historique ──────────────────────────────────
//
// Historique structuré des passages « spécialité de la semaine » d'un produit
// (voir `ProductWeeklySpecial`, prisma/schema.prisma). Alimente la carte dédiée
// du formulaire produit (`product-form.tsx`) : le produit reste commandable
// SEULEMENT dans une fenêtre active dès qu'une ligne existe (voir
// `isWithinAnyPeriod`, lib/supplements.ts) — l'historique lui-même est purement
// consultatif (les lignes passées n'ont plus d'effet sur la disponibilité).

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
