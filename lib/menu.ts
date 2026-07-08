// lib/menu.ts
import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';

export async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
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
  });

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
      supplements: p.supplementGroups
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
  const categories = await prisma.menuCategory.findMany({
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
  });

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
      supplements: p.supplementGroups.map((g) => ({
        name: g.name,
        type: g.type as 'single' | 'multiple' | 'quantity',
        required: g.required,
        available: g.available,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          name: o.name,
          price: o.price,
          available: o.available,
          stockQuantity: o.stockQuantity,
        })),
      })),
    })),
  }));
}
