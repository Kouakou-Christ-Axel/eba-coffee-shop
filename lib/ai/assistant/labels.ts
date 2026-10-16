// lib/ai/assistant/labels.ts
//
// Libellé lisible de la cible d'une action en attente : la carte de
// confirmation ne doit pas montrer un `id` opaque. Meilleur effort : en cas
// d'échec ou d'id inconnu, pas de libellé (la carte se rabat sur les arguments).

import prisma from '@/lib/prisma';

export async function pendingLabel(args: unknown): Promise<string | undefined> {
  const id =
    args && typeof args === 'object' && 'id' in args
      ? (args as { id: unknown }).id
      : undefined;
  if (typeof id !== 'string' || !id) return undefined;
  try {
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
