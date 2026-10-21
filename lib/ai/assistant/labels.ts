// lib/ai/assistant/labels.ts
//
// Libellé lisible de la cible d'une action en attente : la carte de
// confirmation ne doit pas montrer un `id` opaque. Meilleur effort : en cas
// d'échec ou d'id inconnu, pas de libellé (la carte se rabat sur les arguments).

import prisma from '@/lib/prisma';

const LABEL_NAMES_MAX = 5;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

/** Ids visés par un outil « en lot » (`target.ids`, `items[].id`), ou `categoryId` seul. */
function bulkTarget(args: Record<string, unknown>) {
  const target = isRecord(args.target) ? args.target : undefined;
  if (Array.isArray(target?.ids)) {
    return { ids: target.ids.filter((v) => typeof v === 'string') };
  }
  if (typeof target?.categoryId === 'string') {
    return { categoryId: target.categoryId };
  }
  if (Array.isArray(args.items)) {
    const ids = args.items
      .map((i) => (isRecord(i) ? i.id : undefined))
      .filter((v): v is string => typeof v === 'string');
    if (ids.length) return { ids };
  }
  return undefined;
}

async function bulkLabel(target: { ids?: string[]; categoryId?: string }) {
  if (target.categoryId) {
    const category = await prisma.menuCategory.findUnique({
      where: { id: target.categoryId },
      select: { name: true },
    });
    return category ? `Toute la catégorie : ${category.name}` : undefined;
  }
  const ids = target.ids ?? [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { name: true },
  });
  if (!products.length) return undefined;
  const names = products.slice(0, LABEL_NAMES_MAX).map((p) => p.name);
  const more = ids.length - names.length;
  return `${ids.length} produits : ${names.join(', ')}${more > 0 ? `, +${more}` : ''}`;
}

export async function pendingLabel(args: unknown): Promise<string | undefined> {
  if (!isRecord(args)) return undefined;
  try {
    const bulk = bulkTarget(args);
    if (bulk) return await bulkLabel(bulk);
    const id = args.id;
    if (typeof id !== 'string' || !id) return undefined;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { name: true, category: { select: { name: true } } },
    });
    if (product) {
      return `Produit : ${product.name}${product.category ? ` (${product.category.name})` : ''}`;
    }
    const category = await prisma.menuCategory.findUnique({
      where: { id },
      select: { name: true },
    });
    return category ? `Catégorie : ${category.name}` : undefined;
  } catch {
    return undefined;
  }
}
