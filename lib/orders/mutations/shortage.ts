// Mutations de commandes — shortage.

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';
import { computeShortage } from './stock-needs';

/** Pénurie d'une commande existante, en LECTURE SEULE. */
export async function getOrderShortage(id: string): Promise<ShortageLine[]> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { items: true, stockReservedAt: true },
  });
  // Stock déjà réservé : plus rien à produire pour cette commande.
  if (!order || order.stockReservedAt !== null) return [];
  return computeShortage(prisma, order.items as unknown as CartItem[]);
}

export async function getItemsShortage(
  items: CartItem[]
): Promise<ShortageLine[]> {
  return computeShortage(prisma, items);
}

/** Corps de réponse d'un refus pour pénurie. */
export type ShortagePayload = { error: string; shortage: ShortageLine[] };

/** Construit la réponse 409 d'une pénurie : le message ET les lignes manquantes. */
export async function buildShortagePayload(
  id: string,
  err: StockShortageError
): Promise<ShortagePayload> {
  return { error: err.message, shortage: await getOrderShortage(id) };
}

export async function coverShortageForOrderItems(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<ShortageLine[]> {
  const shortage = await computeShortage(tx, items);
  for (const line of shortage) {
    if (line.target === 'product') {
      await tx.product.update({
        where: { id: line.targetId },
        data: { stockQuantity: { increment: line.missing } },
      });
    } else {
      await tx.supplementOption.update({
        where: { id: line.targetId },
        data: { stockQuantity: { increment: line.missing } },
      });
    }
  }
  return shortage;
}
