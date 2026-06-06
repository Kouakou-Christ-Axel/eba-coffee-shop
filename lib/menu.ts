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
