// lib/menu-mutations.ts
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { ADVANCE_ORDER_DAYS_MAX } from '@/config/constants';
import prisma from '@/lib/prisma';
import {
  supplementGroupSchema,
  type SupplementGroupInput,
} from '@/lib/schemas/menu';
import { imageUrlSchema } from '@/lib/schemas/upload';
import { syncSupplementGroups } from '@/lib/supplement-groups-sync';

// ─── Slugify ──────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Trie et dédoublonne une liste de jours (0..6) — évite les doublons/ordre
// arbitraire en base pour `ProductSchedule.days`.
function dedupeDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}

// ─── Schémas Zod ──────────────────────────────────────────────────────────────
//
// Les schémas de suppléments sont centralisés dans `lib/schemas/menu.ts` (règle
// CLAUDE.md : pas de redéclaration inline). `imageUrlSchema` (lib/schemas/upload)
// accepte chemins relatifs locaux ET URLs absolues.

// Planning récurrent (voir `productScheduleSchema` plus bas) : `null` = aucun
// planning (tous les jours), absent = inchangé (mise à jour partielle).
const scheduleFieldSchema = {
  scheduleId: z.string().min(1).nullable().optional(),
};

// Commande à l'avance obligatoire (voir `Product.advanceOrderDays`/
// `MenuCategory.advanceOrderDays`, prisma/schema.prisma) : délai MINIMUM
// (jours) entre la commande et le retrait. `null` = aucune contrainte,
// absent = inchangé (mise à jour partielle). `.min(1)` (pas 0) : zéro jour
// équivaudrait à « pas de contrainte », déjà représenté par `null` — éviter
// la double représentation ambiguë.
const advanceOrderDaysFieldSchema = {
  advanceOrderDays: z
    .number()
    .int()
    .min(1)
    .max(ADVANCE_ORDER_DAYS_MAX)
    .nullable()
    .optional(),
};

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
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
  ...scheduleFieldSchema,
  ...advanceOrderDaysFieldSchema,
  // Commande spéciale sur mesure (ex. gâteau grand format) : exige un acompte
  // minimum au checkout (voir `MIN_DEPOSIT_PERCENT`, config/constants.ts).
  // Absent (update) = inchangé ; absent (create) = false par défaut.
  requiresDeposit: z.boolean().optional(),
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

export type CategoryInput = z.infer<typeof createCategorySchema>;
export type CategoryUpdate = z.infer<typeof updateCategorySchema>;

export async function createCategory(input: CategoryInput) {
  const { name, scheduleId, advanceOrderDays } =
    createCategorySchema.parse(input);
  const existing = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  return prisma.menuCategory.create({
    data: {
      name,
      slug: slugify(name),
      sortOrder: existing.length,
      scheduleId: scheduleId ?? null,
      advanceOrderDays: advanceOrderDays ?? null,
    },
  });
}

// Mise à jour PARTIELLE (même règle que `updateProduct`) : un champ absent
// reste inchangé, `scheduleId: null` efface volontairement le planning.
export async function updateCategory(id: string, input: CategoryUpdate) {
  const data = updateCategorySchema.parse(input);
  return prisma.menuCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.scheduleId !== undefined && { scheduleId: data.scheduleId }),
      ...(data.advanceOrderDays !== undefined && {
        advanceOrderDays: data.advanceOrderDays,
      }),
    },
  });
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

// Vérifie qu'un ordre reçu du client décrit EXACTEMENT l'ensemble courant.
// Un glisser-déposer part d'une liste rendue il y a quelques secondes : entre
// temps un autre admin (ou un outil MCP) a pu créer ou supprimer une ligne.
// Réindexer sur une liste périmée effacerait silencieusement sa modification —
// on refuse, l'UI restaure l'ordre affiché et signale le conflit.
function assertSameSet(
  orderedIds: string[],
  currentIds: string[],
  what: string
) {
  const ordered = new Set(orderedIds);
  if (
    ordered.size !== orderedIds.length ||
    ordered.size !== currentIds.length ||
    currentIds.some((id) => !ordered.has(id))
  ) {
    throw new Error(
      `La liste des ${what} a changé entre-temps. Rechargez la page avant de réordonner.`
    );
  }
}

// Réordonnancement complet (glisser-déposer) : réindexe `sortOrder` sur la
// position dans `orderedIds`. Complémentaire de `moveCategory`, qui échange
// deux voisins et reste utilisé par l'outil MCP `move_category`.
export async function reorderCategories(orderedIds: string[]) {
  const current = await prisma.menuCategory.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  assertSameSet(
    orderedIds,
    current.map((c) => c.id),
    'catégories'
  );

  return prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.menuCategory.update({
        where: { id },
        data: { sortOrder: index },
      });
    }
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
      scheduleId: data.scheduleId ?? null,
      advanceOrderDays: data.advanceOrderDays ?? null,
      requiresDeposit: data.requiresDeposit ?? false,
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
            create: g.options.map((o, oi) => ({
              name: o.name,
              price: o.price,
              available: o.available,
              stockQuantity: o.stockQuantity ?? null,
              sortOrder: oi,
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
    ...(data.scheduleId !== undefined && { scheduleId: data.scheduleId }),
    ...(data.advanceOrderDays !== undefined && {
      advanceOrderDays: data.advanceOrderDays,
    }),
    ...(data.requiresDeposit !== undefined && {
      requiresDeposit: data.requiresDeposit,
    }),
  };

  // Les groupes de suppléments ne sont remplacés QUE s'ils sont fournis. Absents
  // → on ne touche pas aux suppléments existants (pas de transaction inutile).
  if (data.supplementGroups === undefined) {
    return prisma.product.update({ where: { id }, data: scalar });
  }

  return updateSupplementGroups(id, scalar, data.supplementGroups);
}

// Synchronise les groupes/options de suppléments d'un produit (voir
// `syncSupplementGroups`, partagée avec `updateGlobalExtraGroups` pour les
// extras globaux). Un groupe/option renommé est traité comme supprimé + recréé
// (limitation acceptée : pas de contrainte d'unicité sur `name` pour permettre
// un vrai suivi par id).
async function updateSupplementGroups(
  productId: string,
  scalar: Prisma.ProductUpdateInput,
  groups: SupplementGroupInput[]
) {
  return prisma.$transaction(async (tx) => {
    await syncSupplementGroups(tx, { productId }, groups);
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

// Réordonnancement complet (glisser-déposer) DANS une catégorie. Complémentaire
// de `moveProduct`, qui échange deux voisins et reste utilisé par l'outil MCP
// `move_product`.
export async function reorderProducts(
  categoryId: string,
  orderedIds: string[]
) {
  const current = await prisma.product.findMany({
    where: { categoryId, deletedAt: null },
    select: { id: true },
  });
  assertSameSet(
    orderedIds,
    current.map((p) => p.id),
    'produits'
  );

  return prisma.$transaction(async (tx) => {
    for (const [index, id] of orderedIds.entries()) {
      await tx.product.update({ where: { id }, data: { sortOrder: index } });
    }
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
// le dashboard et les outils MCP, sans dupliquer la logique de décrément à
// l'entrée en cuisine (qui vit dans `lib/order-mutations.ts`, hors périmètre de
// ce fichier).

// Définit ABSOLUMENT le stock d'un produit (« définir le matin »), par
// opposition à l'incrément relatif de `restockProduct` (« + nouvelle fournée »
// en journée). `null` repasse le produit en illimité.
export async function setProductStock(id: string, quantity: number | null) {
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) throw new Error('Produit introuvable');
  return prisma.product.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
}

// Équivalent de `setProductStock` pour une option de supplément (« goût »).
export async function setOptionStock(id: string, quantity: number | null) {
  const o = await prisma.supplementOption.findUnique({ where: { id } });
  if (!o) throw new Error('Option introuvable');
  return prisma.supplementOption.update({
    where: { id },
    data: { stockQuantity: quantity },
  });
}

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

// Réappro caisse d'une option (« goût ») : le caissier DÉFINIT directement le
// nombre disponible (valeur absolue), pas un ajout. Le panier/menu ne connaît
// que les NOMS (produit → groupe → option), jamais l'id interne — on résout
// donc l'id (option la plus ancienne portant ce nom dans ce groupe, comme le
// décrément à l'entrée en cuisine) avant d'écrire le stock. Renvoie le nouveau
// stock.
export async function setOptionStockByRef(input: {
  productId: string;
  groupName: string;
  optionName: string;
  stock: number;
}): Promise<{ stockQuantity: number | null }> {
  const option = await prisma.supplementOption.findFirst({
    where: {
      name: input.optionName,
      // Groupe propre au produit OU global (« Extras »), même résolution que
      // `decrementStockForOrderItems` (lib/order-mutations.ts).
      group: {
        name: input.groupName,
        OR: [{ productId: input.productId }, { isGlobal: true }],
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!option) throw new Error('Option introuvable');

  const updated = await prisma.supplementOption.update({
    where: { id: option.id },
    data: { stockQuantity: input.stock },
    select: { stockQuantity: true },
  });
  return { stockQuantity: updated.stockQuantity };
}

// Réappro caisse d'un produit par id : DÉFINIT le nombre disponible (absolu).
// Renvoie le nouveau stock.
export async function setProductStockById(input: {
  productId: string;
  stock: number;
}): Promise<{ stockQuantity: number | null }> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) throw new Error('Produit introuvable');

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data: { stockQuantity: input.stock },
    select: { stockQuantity: true },
  });
  return { stockQuantity: updated.stockQuantity };
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

// ─── Plannings récurrents (« à la cal.com ») ────────────────────────────────
//
// Un `ProductSchedule` est nommé et réutilisable, assignable à plusieurs
// produits ET catégories (`scheduleId` sur les deux, voir §A du plan). CRUD
// calqué sur `createCategory`/`updateCategory`/`deleteCategory` — pas de
// soft-delete (rien de client-facing à préserver), la relation optionnelle
// `onDelete: SetNull` (prisma/schema.prisma) désassigne automatiquement tout
// ce qui utilisait le planning supprimé.

export const productScheduleSchema = z.object({
  name: z.string().min(1).max(60),
  // 0=dimanche…6=samedi, au moins un jour (un planning sans jour n'a pas de
  // sens — contrairement à `Product.availableDays`/`MenuCategory.availableDays`
  // résolus, où un tableau vide signale une intersection sans jour commun).
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export const productScheduleUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
});

export type ProductScheduleInput = z.infer<typeof productScheduleSchema>;
export type ProductScheduleUpdateInput = z.infer<
  typeof productScheduleUpdateSchema
>;

export async function createProductSchedule(input: ProductScheduleInput) {
  const data = productScheduleSchema.parse(input);
  return prisma.productSchedule.create({
    data: { name: data.name, days: dedupeDays(data.days) },
  });
}

// Mise à jour PARTIELLE : un champ absent reste inchangé.
export async function updateProductSchedule(
  id: string,
  input: ProductScheduleUpdateInput
) {
  const data = productScheduleUpdateSchema.parse(input);
  return prisma.productSchedule.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.days !== undefined && { days: dedupeDays(data.days) }),
    },
  });
}

// Supprime le planning : les produits/catégories qui l'utilisaient redeviennent
// disponibles tous les jours (`onDelete: SetNull`), rien d'autre n'est touché.
export async function deleteProductSchedule(id: string) {
  return prisma.productSchedule.delete({ where: { id } });
}

// ─── Spécialité de la semaine ────────────────────────────────────────────────
//
// `ProductWeeklySpecial` est un historique structuré : chaque ligne est un
// passage (programmé, en cours ou passé). Dès qu'au moins une ligne existe
// pour un produit, il n'est commandable QUE dans une fenêtre active — voir
// `isWithinAnyPeriod` (lib/supplements.ts). Pas de soft-delete : supprimer une
// ligne annule le passage, ça n'a pas vocation à rester masqué.

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const productWeeklySpecialSchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD'),
    endDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD'),
    note: z.string().max(200).nullable().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La date de fin doit être après la date de début',
    path: ['endDate'],
  });

export const productWeeklySpecialUpdateSchema = z
  .object({
    startDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD').optional(),
    endDate: z.string().regex(DATE_ONLY_RE, 'Format YYYY-MM-DD').optional(),
    note: z.string().max(200).nullable().optional(),
  })
  .refine(
    (v) =>
      v.startDate === undefined ||
      v.endDate === undefined ||
      v.endDate >= v.startDate,
    {
      message: 'La date de fin doit être après la date de début',
      path: ['endDate'],
    }
  );

export type ProductWeeklySpecialInput = z.infer<
  typeof productWeeklySpecialSchema
>;
export type ProductWeeklySpecialUpdateInput = z.infer<
  typeof productWeeklySpecialUpdateSchema
>;

export async function createProductWeeklySpecial(
  productId: string,
  input: ProductWeeklySpecialInput
) {
  const data = productWeeklySpecialSchema.parse(input);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new Error('Produit introuvable');
  return prisma.productWeeklySpecial.create({
    data: {
      productId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      note: data.note ?? null,
    },
  });
}

// Mise à jour PARTIELLE : un champ absent reste inchangé.
export async function updateProductWeeklySpecial(
  id: string,
  input: ProductWeeklySpecialUpdateInput
) {
  const data = productWeeklySpecialUpdateSchema.parse(input);
  return prisma.productWeeklySpecial.update({
    where: { id },
    data: {
      ...(data.startDate !== undefined && {
        startDate: new Date(data.startDate),
      }),
      ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });
}

export async function deleteProductWeeklySpecial(id: string) {
  return prisma.productWeeklySpecial.delete({ where: { id } });
}
