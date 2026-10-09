// lib/orders/mutations/shortage.ts
//
// Mutations de commandes — shortage (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';
import { computeShortage } from './stock-needs';

/**
 * Pénurie d'une commande existante, en LECTURE SEULE. Appelée sur le chemin
 * d'erreur (409) pour construire la question posée au staff : elle donne la
 * liste COMPLÈTE des manques, là où le décrément s'arrête à la première ligne
 * fautive.
 */
export async function getOrderShortage(id: string): Promise<ShortageLine[]> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { items: true, stockReservedAt: true },
  });
  // Stock déjà réservé : plus rien à produire pour cette commande.
  if (!order || order.stockReservedAt !== null) return [];
  return computeShortage(prisma, order.items as unknown as CartItem[]);
}

/**
 * Même calcul que `getOrderShortage`, mais pour un panier qui n'est pas
 * encore une commande en base (échec de `createCashierOrder` sur pénurie à
 * la création — la transaction a déjà tout annulé, il n'y a pas d'id à
 * relire).
 */
export async function getItemsShortage(
  items: CartItem[]
): Promise<ShortageLine[]> {
  return computeShortage(prisma, items);
}

/** Corps de réponse d'un refus pour pénurie. */
export type ShortagePayload = { error: string; shortage: ShortageLine[] };

/**
 * Construit la réponse 409 d'une pénurie : le message ET les lignes manquantes.
 * C'est ce qui permet à l'écran de poser une question chiffrée (« il manque
 * 3 × Sponge cake (Vanille), vous les avez produits ? ») au lieu d'un mur qui
 * renvoie le staff vers /dashboard/menu.
 *
 * `getOrderShortage` relit le stock : la liste est donc COMPLÈTE, là où
 * l'exception s'arrête à la première ligne fautive.
 */
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
