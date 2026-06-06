// lib/menu.ts
import prisma from '@/lib/prisma';
import type { MenuCategory } from '@/config/menu';

export async function getMenu(): Promise<MenuCategory[]> {
  const categories = await prisma.menuCategory.findMany({
    where: { available: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
        where: { available: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          supplementGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              options: true,
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
      supplements: p.supplementGroups.map((g) => ({
        name: g.name,
        type: g.type as 'single' | 'multiple',
        required: g.required,
        options: g.options.map((o) => ({
          name: o.name,
          price: o.price,
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

export type AdminMenuSupplementOption = { name: string; price: number };
export type AdminMenuSupplementGroup = {
  name: string;
  type: 'single' | 'multiple';
  required: boolean;
  options: AdminMenuSupplementOption[];
};
export type AdminMenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  available: boolean;
  featured: boolean;
  featuredOrder: number;
  featuredBadge: string | null;
  sortOrder: number;
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
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
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
      imageUrl: p.imageUrl ?? null,
      available: p.available,
      featured: p.featured,
      featuredOrder: p.featuredOrder,
      featuredBadge: p.featuredBadge ?? null,
      sortOrder: p.sortOrder,
      supplements: p.supplementGroups.map((g) => ({
        name: g.name,
        type: g.type as 'single' | 'multiple',
        required: g.required,
        options: g.options.map((o) => ({ name: o.name, price: o.price })),
      })),
    })),
  }));
}
