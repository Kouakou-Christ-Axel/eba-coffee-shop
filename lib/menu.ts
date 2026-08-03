// lib/menu.ts
import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';

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
        products: {
          // `available: true` masque un produit désactivé manuellement, mais un
          // produit à stock 0 (épuisé) ou en pause reste visible (champs dérivés
          // `soldOut`/`remaining`/`unavailableUntil` ci-dessous) : le masquage
          // dur reste réservé au drapeau `available`.
          where: { available: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
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

  return categories.map((cat) => ({
    id: cat.slug,
    name: cat.name,
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
  }));
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
  supplements: AdminMenuSupplementGroup[];
};
export type AdminMenuCategory = {
  id: string;
  slug: string;
  name: string;
  available: boolean;
  sortOrder: number;
  products: AdminMenuProduct[];
};

export async function getMenuAdmin(): Promise<AdminMenuCategory[]> {
  const [categories, globalGroups] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
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

  return categories.map((cat) => ({
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    available: cat.available,
    sortOrder: cat.sortOrder,
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
  }));
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
