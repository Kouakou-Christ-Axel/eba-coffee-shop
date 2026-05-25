// prisma/seed.ts
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { menu } from '@/config/menu';

type SeedablePrisma = {
  menuCategory: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export async function seedMenu(prisma: SeedablePrisma) {
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
            sortOrder: pi,
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

// Bun : import.meta.main est true uniquement quand ce fichier est l'entrypoint
// @ts-expect-error -- propriété Bun-spécifique non typée dans le DOM lib standard
if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
