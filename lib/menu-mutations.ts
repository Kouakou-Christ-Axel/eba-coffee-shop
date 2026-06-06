// lib/menu-mutations.ts
import { z } from 'zod';
import prisma from '@/lib/prisma';

// ─── Slugify ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Schémas Zod ──────────────────────────────────────────────────────────────

const supplementOptionSchema = z.object({
  name: z.string().min(1).max(80),
  price: z.number().int().nonnegative(),
});

const supplementGroupSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['single', 'multiple']),
  required: z.boolean(),
  options: z.array(supplementOptionSchema),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80),
});

const featuredFieldsSchema = {
  featured: z.boolean().optional().default(false),
  featuredOrder: z.number().int().nonnegative().optional().default(0),
  featuredBadge: z.string().min(1).max(40).nullable().optional(),
};

const costFieldsSchema = {
  coutMatiere: z.number().int().nonnegative().optional().default(0),
  coutEmballage: z.number().int().nonnegative().optional().default(0),
};

export const productInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema),
  ...featuredFieldsSchema,
  ...costFieldsSchema,
});

export const productUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
  supplementGroups: z.array(supplementGroupSchema),
  ...featuredFieldsSchema,
  ...costFieldsSchema,
});

// ─── Catégories ───────────────────────────────────────────────────────────────

export async function createCategory(input: { name: string }) {
  const { name } = createCategorySchema.parse(input);
  const existing = await prisma.menuCategory.findMany({ select: { id: true } });
  return prisma.menuCategory.create({
    data: { name, slug: slugify(name), sortOrder: existing.length },
  });
}

export async function updateCategory(id: string, input: { name: string }) {
  const { name } = updateCategorySchema.parse(input);
  return prisma.menuCategory.update({ where: { id }, data: { name } });
}

export async function deleteCategory(id: string) {
  return prisma.menuCategory.delete({ where: { id } });
}

export async function toggleCategoryAvailability(id: string) {
  const cat = await prisma.menuCategory.findUnique({ where: { id } });
  if (!cat) throw new Error('Catégorie introuvable');
  return prisma.menuCategory.update({
    where: { id },
    data: { available: !cat.available },
  });
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const all = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Catégorie introuvable');
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.menuCategory.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.menuCategory.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

// ─── Produits ─────────────────────────────────────────────────────────────────

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export async function createProduct(input: ProductInput) {
  const data = productInputSchema.parse(input);
  const existing = await prisma.product.findMany({
    where: { categoryId: data.categoryId },
    select: { id: true },
  });
  return prisma.product.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      coutMatiere: data.coutMatiere,
      coutEmballage: data.coutEmballage,
      imageUrl: data.imageUrl ?? null,
      sortOrder: existing.length,
      featured: data.featured,
      featuredOrder: data.featuredOrder,
      featuredBadge: data.featuredBadge ?? null,
      supplementGroups: {
        create: data.supplementGroups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          sortOrder: gi,
          options: {
            create: g.options.map((o) => ({ name: o.name, price: o.price })),
          },
        })),
      },
    },
  });
}

export async function updateProduct(id: string, input: ProductUpdate) {
  const data = productUpdateSchema.parse(input);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new Error('Produit introuvable');

  return prisma.$transaction(async (tx) => {
    await tx.supplementGroup.deleteMany({ where: { productId: id } });
    return tx.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        coutMatiere: data.coutMatiere,
        coutEmballage: data.coutEmballage,
        imageUrl: data.imageUrl,
        featured: data.featured,
        featuredOrder: data.featuredOrder,
        featuredBadge: data.featuredBadge ?? null,
        supplementGroups: {
          create: data.supplementGroups.map((g, gi) => ({
            name: g.name,
            type: g.type,
            required: g.required,
            sortOrder: gi,
            options: {
              create: g.options.map((o) => ({ name: o.name, price: o.price })),
            },
          })),
        },
      },
    });
  });
}

export async function deleteProduct(id: string) {
  return prisma.product.delete({ where: { id } });
}

export async function toggleProductAvailability(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { available: !p.available },
  });
}

export async function toggleProductFeatured(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { featured: !p.featured },
  });
}
