// lib/menu-mutations.ts
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  supplementGroupSchema,
  type SupplementGroupInput,
} from '@/lib/schemas/menu';
import { imageUrlSchema } from '@/lib/schemas/upload';

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
//
// Les schémas de suppléments sont centralisés dans `lib/schemas/menu.ts` (règle
// CLAUDE.md : pas de redéclaration inline). `imageUrlSchema` (lib/schemas/upload)
// accepte chemins relatifs locaux ET URLs absolues.

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

const availabilityFieldsSchema = {
  // Stock vendable courant. `null`/absent = illimité (comportement inchangé) ;
  // entier = quantité restante suivie ; `0` = épuisé.
  stockQuantity: z.number().int().nonnegative().nullable().optional(),
  // Pause programmée (ISO 8601). `null`/absent = pas de pause.
  unavailableUntil: z.string().datetime().nullable().optional(),
};

export const productInputSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  price: z.number().int().nonnegative(),
  imageUrl: imageUrlSchema.nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema),
  ...featuredFieldsSchema,
  ...costFieldsSchema,
  ...availabilityFieldsSchema,
});

// Mise à jour PARTIELLE : tous les champs sont optionnels. Seuls les champs
// FOURNIS sont modifiés — un champ absent est laissé intact (et non remis à sa
// valeur par défaut). Indispensable pour un client agentique (MCP) qui ne
// renvoie que ce qu'il veut changer, sans risquer d'effacer le reste.
export const productUpdateSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  price: z.number().int().nonnegative().optional(),
  imageUrl: imageUrlSchema.nullable().optional(),
  supplementGroups: z.array(supplementGroupSchema).optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().nonnegative().optional(),
  featuredBadge: z.string().min(1).max(40).nullable().optional(),
  coutMatiere: z.number().int().nonnegative().optional(),
  coutEmballage: z.number().int().nonnegative().optional(),
  ...availabilityFieldsSchema,
});

// ─── Catégories ───────────────────────────────────────────────────────────────

export async function createCategory(input: { name: string }) {
  const { name } = createCategorySchema.parse(input);
  const existing = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  return prisma.menuCategory.create({
    data: { name, slug: slugify(name), sortOrder: existing.length },
  });
}

export async function updateCategory(id: string, input: { name: string }) {
  const { name } = updateCategorySchema.parse(input);
  return prisma.menuCategory.update({ where: { id }, data: { name } });
}

// Soft delete : on marque la catégorie ET ses produits comme supprimés (au lieu
// d'un DELETE en cascade). Le `slug` (unique) est dé-collisionné pour autoriser
// la recréation ultérieure d'une catégorie du même nom.
export async function deleteCategory(id: string) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const cat = await tx.menuCategory.findUnique({
      where: { id },
      select: { slug: true, deletedAt: true },
    });
    if (!cat) throw new Error('Catégorie introuvable');
    await tx.product.updateMany({
      where: { categoryId: id, deletedAt: null },
      data: { deletedAt: now },
    });
    return tx.menuCategory.update({
      where: { id },
      data: { deletedAt: now, slug: `${cat.slug}-deleted-${id}` },
    });
  });
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
    where: { deletedAt: null },
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
    where: { categoryId: data.categoryId, deletedAt: null },
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
      stockQuantity: data.stockQuantity ?? null,
      unavailableUntil: data.unavailableUntil
        ? new Date(data.unavailableUntil)
        : null,
      supplementGroups: {
        create: data.supplementGroups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          available: g.available,
          minSelect: g.minSelect ?? null,
          maxSelect: g.maxSelect ?? null,
          sortOrder: gi,
          options: {
            create: g.options.map((o) => ({
              name: o.name,
              price: o.price,
              available: o.available,
              stockQuantity: o.stockQuantity ?? null,
            })),
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

  // N'écrit QUE les champs scalaires explicitement fournis (un champ absent =
  // inchangé). `featuredBadge: null` reste un effacement volontaire et valide.
  const scalar = {
    ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
    ...(data.featured !== undefined && { featured: data.featured }),
    ...(data.featuredOrder !== undefined && {
      featuredOrder: data.featuredOrder,
    }),
    ...(data.featuredBadge !== undefined && {
      featuredBadge: data.featuredBadge,
    }),
    ...(data.coutMatiere !== undefined && { coutMatiere: data.coutMatiere }),
    ...(data.coutEmballage !== undefined && {
      coutEmballage: data.coutEmballage,
    }),
    ...(data.stockQuantity !== undefined && {
      stockQuantity: data.stockQuantity,
    }),
    ...(data.unavailableUntil !== undefined && {
      unavailableUntil: data.unavailableUntil
        ? new Date(data.unavailableUntil)
        : null,
    }),
  };

  // Les groupes de suppléments ne sont remplacés QUE s'ils sont fournis. Absents
  // → on ne touche pas aux suppléments existants (pas de transaction inutile).
  if (data.supplementGroups === undefined) {
    return prisma.product.update({ where: { id }, data: scalar });
  }

  return updateSupplementGroups(id, scalar, data.supplementGroups);
}

// Synchronise les groupes/options de suppléments d'un produit par UPSERT
// (apparié par `name`) plutôt que par delete+recreate : les groupes/options
// dont le nom est conservé gardent leur `id` — important maintenant qu'il y a
// des données de production (pas de FK depuis les commandes, mais on évite un
// churn d'identifiants inutile à chaque sauvegarde admin). Un groupe/option
// renommé est traité comme supprimé + recréé (limitation acceptée : pas de
// contrainte d'unicité sur `name` pour permettre un vrai suivi par id).
async function updateSupplementGroups(
  productId: string,
  scalar: Prisma.ProductUpdateInput,
  groups: SupplementGroupInput[]
) {
  return prisma.$transaction(async (tx) => {
    const currentGroups = await tx.supplementGroup.findMany({
      where: { productId },
      include: { options: true },
    });
    const currentGroupByName = new Map(currentGroups.map((g) => [g.name, g]));
    const keepGroupNames = new Set(groups.map((g) => g.name));

    const removedGroupIds = currentGroups
      .filter((g) => !keepGroupNames.has(g.name))
      .map((g) => g.id);
    if (removedGroupIds.length > 0) {
      await tx.supplementGroup.deleteMany({
        where: { id: { in: removedGroupIds } },
      });
    }

    for (const [gi, g] of groups.entries()) {
      const groupData = {
        name: g.name,
        type: g.type,
        required: g.required,
        available: g.available,
        minSelect: g.minSelect ?? null,
        maxSelect: g.maxSelect ?? null,
        sortOrder: gi,
      };
      const match = currentGroupByName.get(g.name);

      if (!match) {
        await tx.supplementGroup.create({
          data: {
            ...groupData,
            productId,
            options: {
              create: g.options.map((o) => ({
                name: o.name,
                price: o.price,
                available: o.available,
                stockQuantity: o.stockQuantity ?? null,
              })),
            },
          },
        });
        continue;
      }

      await tx.supplementGroup.update({
        where: { id: match.id },
        data: groupData,
      });

      const currentOptionByName = new Map(
        match.options.map((o) => [o.name, o])
      );
      const keepOptionNames = new Set(g.options.map((o) => o.name));
      const removedOptionIds = match.options
        .filter((o) => !keepOptionNames.has(o.name))
        .map((o) => o.id);
      if (removedOptionIds.length > 0) {
        await tx.supplementOption.deleteMany({
          where: { id: { in: removedOptionIds } },
        });
      }

      for (const o of g.options) {
        const optionMatch = currentOptionByName.get(o.name);
        const optionData = {
          name: o.name,
          price: o.price,
          available: o.available,
          stockQuantity: o.stockQuantity ?? null,
        };
        if (optionMatch) {
          await tx.supplementOption.update({
            where: { id: optionMatch.id },
            data: optionData,
          });
        } else {
          await tx.supplementOption.create({
            data: { ...optionData, groupId: match.id },
          });
        }
      }
    }

    return tx.product.update({ where: { id: productId }, data: scalar });
  });
}

// Réordonne un produit d'un cran (haut/bas) DANS sa catégorie, en échangeant son
// `sortOrder` avec celui de son voisin. Symétrique de `moveCategory`.
export async function moveProduct(id: string, direction: 'up' | 'down') {
  const product = await prisma.product.findUnique({
    where: { id },
    select: { categoryId: true },
  });
  if (!product) throw new Error('Produit introuvable');

  const all = await prisma.product.findMany({
    where: { categoryId: product.categoryId, deletedAt: null },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((p) => p.id === id);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return;

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.product.update({
    where: { id: a.id },
    data: { sortOrder: b.sortOrder },
  });
  await prisma.product.update({
    where: { id: b.id },
    data: { sortOrder: a.sortOrder },
  });
}

// Soft delete : on marque le produit comme supprimé (conservé en base, masqué
// partout). Ses suppléments restent rattachés.
export async function deleteProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
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

// ─── Stock & pause (atomique) ────────────────────────────────────────────────
//
// Mises à jour ABSOLUES du stock (`stockQuantity`) et de la pause
// (`unavailableUntil`) : cf. `scalar` dans `updateProduct` / `optionData` dans
// `updateSupplementGroups`. Les fonctions ci-dessous couvrent les gestes
// complémentaires — incrément relatif (« + fournée ») et bascule pause — pour
// le dashboard et les outils MCP, sans dupliquer la logique de décrément au
// paiement (qui vit dans `lib/order-mutations.ts`, hors périmètre de ce fichier).

// Incrémente (ou décrémente si `delta` est négatif) le stock d'un produit.
// No-op impossible sur un produit à stock illimité (`stockQuantity === null`) :
// on refuse explicitement plutôt que de silencieusement transformer un produit
// illimité en produit à stock 0/négatif.
export async function restockProduct(id: string, delta: number) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: { stockQuantity: true },
  });
  if (!p) throw new Error('Produit introuvable');
  if (p.stockQuantity === null) {
    throw new Error(
      'Produit à stock illimité : impossible de réapprovisionner'
    );
  }
  return prisma.product.update({
    where: { id },
    data: { stockQuantity: { increment: delta } },
  });
}

// Équivalent de `restockProduct` pour une option de supplément (« goût »).
export async function restockOption(id: string, delta: number) {
  const o = await prisma.supplementOption.findUnique({
    where: { id },
    select: { stockQuantity: true },
  });
  if (!o) throw new Error('Option introuvable');
  if (o.stockQuantity === null) {
    throw new Error('Option à stock illimité : impossible de réapprovisionner');
  }
  return prisma.supplementOption.update({
    where: { id },
    data: { stockQuantity: { increment: delta } },
  });
}

// Met un produit en pause jusqu'à `until` (non commandable, mais toujours
// visible côté carte publique avec un tag de statut). La reprise est ensuite
// automatique : calculée à la lecture (`unavailableUntil > now`), sans cron.
export async function pauseProduct(id: string, until: Date) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { unavailableUntil: until },
  });
}

// Lève une pause manuellement (avant son terme naturel).
export async function resumeProduct(id: string) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { unavailableUntil: null },
  });
}
