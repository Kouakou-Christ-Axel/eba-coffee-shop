// prisma/seed.ts
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { menu } from '@/config/menu';

type SeedablePrisma = {
  menuCategory: {
    create: (args: unknown) => Promise<unknown>;
    deleteMany: (args?: unknown) => Promise<unknown>;
  };
};

export async function seedMenu(prisma: SeedablePrisma) {
  await prisma.menuCategory.deleteMany({});

  for (let i = 0; i < menu.length; i++) {
    const category = menu[i];
    await prisma.menuCategory.create({
      data: {
        name: category.name,
        slug: category.id,
        sortOrder: i,
        products: {
          create: category.products.map((p, pi) => ({
            name: p.name,
            description: p.description,
            price: p.price,
            imageUrl: p.image ?? null,
            sortOrder: pi,
            featured: p.featured ?? false,
            featuredOrder: p.featuredOrder ?? 0,
            featuredBadge: p.featuredBadge ?? null,
            supplementGroups: {
              create: (p.supplements ?? []).map((g, gi) => ({
                name: g.name,
                type: g.type,
                required: g.required,
                sortOrder: gi,
                options: {
                  create: g.options.map((o) => ({
                    name: o.name,
                    price: o.price,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
  }
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedMenu(prisma as SeedablePrisma);
    console.log('Seed terminé avec succès.');
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  // Bun
  // @ts-expect-error -- propriété Bun-spécifique non typée
  import.meta.main === true ||
  // Node / tsx
  (typeof process !== 'undefined' &&
    process.argv[1] === fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
