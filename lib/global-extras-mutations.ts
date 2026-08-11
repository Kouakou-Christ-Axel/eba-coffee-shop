// lib/global-extras-mutations.ts
//
// CRUD des groupes/options « Extras globaux » : un supplément configuré UNE
// fois (ex. « Chantilly ») et proposé automatiquement sur TOUS les produits,
// sans devoir le rattacher à chacun (voir `SupplementGroup.isGlobal`,
// prisma/schema.prisma). Adressage par `id` (pas par nom comme les groupes
// propres à un produit dans `lib/menu-mutations.ts`), car ces groupes vivent
// dans leur propre écran admin plutôt que dans un formulaire produit.

import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  globalExtraGroupInputSchema,
  globalExtraGroupUpdateSchema,
  globalExtraOptionUpdateSchema,
  supplementGroupSchema,
  supplementOptionSchema,
  type GlobalExtraGroupInput,
  type GlobalExtraGroupUpdate,
  type GlobalExtraOptionUpdate,
  type SupplementGroupInput,
  type SupplementOptionInput,
} from '@/lib/schemas/menu';
import { syncSupplementGroups } from '@/lib/supplement-groups-sync';

export async function createGlobalExtraGroup(input: GlobalExtraGroupInput) {
  const data = globalExtraGroupInputSchema.parse(input);
  const existing = await prisma.supplementGroup.findMany({
    where: { isGlobal: true },
    select: { id: true },
  });
  return prisma.supplementGroup.create({
    data: {
      name: data.name,
      type: data.type,
      required: data.required,
      available: data.available,
      minSelect: data.minSelect ?? null,
      maxSelect: data.maxSelect ?? null,
      sortOrder: existing.length,
      isGlobal: true,
      productId: null,
    },
  });
}

// Sauvegarde en bloc (écran admin « Extras globaux », sur le même modèle que
// `SupplementsEditor` produit) : remplace l'ensemble des groupes/options
// globaux par ceux fournis, upsert par nom (voir `syncSupplementGroups`). Pour
// une modification unitaire (ex. client MCP), préférer les fonctions
// `create/update/delete_global_extra_*` ci-dessous.
export async function updateGlobalExtraGroups(groups: SupplementGroupInput[]) {
  const parsed = z.array(supplementGroupSchema).parse(groups);
  return prisma.$transaction((tx) =>
    syncSupplementGroups(tx, { isGlobal: true }, parsed)
  );
}

async function requireGlobalGroup(id: string) {
  const group = await prisma.supplementGroup.findUnique({ where: { id } });
  if (!group || !group.isGlobal) {
    throw new Error('Groupe d’extras global introuvable');
  }
  return group;
}

export async function updateGlobalExtraGroup(
  id: string,
  input: GlobalExtraGroupUpdate
) {
  const data = globalExtraGroupUpdateSchema.parse(input);
  await requireGlobalGroup(id);
  return prisma.supplementGroup.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.required !== undefined && { required: data.required }),
      ...(data.available !== undefined && { available: data.available }),
      ...(data.minSelect !== undefined && { minSelect: data.minSelect }),
      ...(data.maxSelect !== undefined && { maxSelect: data.maxSelect }),
    },
  });
}

// Suppression définitive (pas de soft delete) : un groupe d'extras global est
// une configuration pure, sans historique de commande qui y référerait par id
// (les commandes le résolvent par nom, cf. lib/order-mutations.ts) — cascade
// sur ses options.
export async function deleteGlobalExtraGroup(id: string) {
  await requireGlobalGroup(id);
  return prisma.supplementGroup.delete({ where: { id } });
}

export async function createGlobalExtraOption(input: {
  groupId: string;
  option: SupplementOptionInput;
}) {
  const option = supplementOptionSchema.parse(input.option);
  await requireGlobalGroup(input.groupId);
  // Ajout en fin de groupe : sans ce calcul, l'option prendrait le `sortOrder`
  // 0 par défaut et se placerait devant les options existantes.
  const last = await prisma.supplementOption.findFirst({
    where: { groupId: input.groupId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  return prisma.supplementOption.create({
    data: {
      name: option.name,
      price: option.price,
      available: option.available,
      stockQuantity: option.stockQuantity ?? null,
      sortOrder: last ? last.sortOrder + 1 : 0,
      groupId: input.groupId,
    },
  });
}

async function requireGlobalOption(id: string) {
  const option = await prisma.supplementOption.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!option || !option.group.isGlobal) {
    throw new Error('Option d’extra global introuvable');
  }
  return option;
}

export async function updateGlobalExtraOption(
  id: string,
  input: GlobalExtraOptionUpdate
) {
  const data = globalExtraOptionUpdateSchema.parse(input);
  await requireGlobalOption(id);
  return prisma.supplementOption.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.available !== undefined && { available: data.available }),
      ...(data.stockQuantity !== undefined && {
        stockQuantity: data.stockQuantity,
      }),
    },
  });
}

export async function deleteGlobalExtraOption(id: string) {
  await requireGlobalOption(id);
  return prisma.supplementOption.delete({ where: { id } });
}
