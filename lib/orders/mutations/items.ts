// lib/orders/mutations/items.ts
//
// Mutations de commandes — items (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
import type { CartItem } from '@/lib/cart-store';
import { OrderMutationError } from './errors';
import { resyncStockForItemChange } from './stock-resync';

// ─── Mise à jour des articles (et donc des remises) ───────────────────────────

/**
 * Remplace les articles d'une commande et recalcule son total (net après
 * remises). Sert à ajouter/retirer des produits ET à appliquer des remises de
 * ligne. Refuse une commande terminée/annulée et plafonne chaque remise.
 *
 * STOCK : si la commande a DÉJÀ réservé (`stockReservedAt` non nul), le stock
 * est réaligné sur le nouveau contenu dans la même transaction — décrément des
 * ajouts, recrédit des retraits (cf. `resyncStockForItemChange`). Sans cela,
 * ajouter un article à une commande partie en cuisine ne le décomptait jamais,
 * et en retirer un le laissait décompté pour toujours.
 *
 * `opts.restoreRemovedStock: false` : l'article retiré était déjà préparé, on
 * ne le recrédite pas. Défaut `true`.
 *
 * `opts.coverShortage` : même geste que sur `sendOrderToKitchen`/
 * `setOrderPayment`/`payAndComplete` — le staff a confirmé avoir produit la
 * quantité manquante, le delta ajouté est couvert avant d'être décompté plutôt
 * que refusé. Sans ce filet, une vraie fournée supplémentaire ne pouvait être
 * ajoutée à une commande déjà en cuisine qu'en annulant/recréant la commande.
 *
 * Lève `OrderMutationError` (400 liste vide / remise trop élevée, 404
 * introuvable, 409 commande terminée) ou `StockShortageError` (409, si les
 * articles ajoutés dépassent le stock et que `coverShortage` n'est pas posé).
 * Renvoie le nouveau total.
 */
export async function updateOrderItems(
  id: string,
  items: CartItem[],
  opts?: { restoreRemovedStock?: boolean; coverShortage?: boolean }
): Promise<{ total: number }> {
  if (items.length === 0) {
    throw new OrderMutationError(
      'La commande doit avoir au moins un article',
      400
    );
  }

  // Plafond de remise par ligne (sécurité serveur, en plus de la validation UI).
  for (const item of items) {
    if ((item.discount ?? 0) > getMaxItemDiscount(item)) {
      throw new OrderMutationError(
        `Remise trop élevée sur « ${item.productName} »`,
        400
      );
    }
  }

  // Lecture DANS la transaction : les articles relus servent de base au delta
  // de stock, ils doivent donc être ceux sur lesquels on écrit — sinon deux
  // éditions concurrentes calculeraient leur delta sur le même état d'origine.
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        loyaltyDiscount: true,
        items: true,
        stockReservedAt: true,
      },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new OrderMutationError(
        'Impossible de modifier une commande terminée ou annulée',
        409
      );
    }

    // Réalignement du stock AVANT l'écriture : une pénurie sur les articles
    // ajoutés fait échouer toute la transaction, la commande reste intacte.
    // Rien à faire tant que la commande n'a pas réservé — la future entrée en
    // cuisine décomptera les articles finaux tels quels.
    if (order.stockReservedAt !== null) {
      await resyncStockForItemChange(
        tx,
        order.items as unknown as CartItem[],
        items,
        opts?.restoreRemovedStock ?? true,
        opts?.coverShortage ?? false
      );
    }

    // Total net recalculé côté serveur (après remises), en conservant la
    // récompense fidélité déjà appliquée à la commande (sinon un simple ajout /
    // retrait d'article efface silencieusement sa déduction du total, alors que
    // `loyaltyDiscount`/`loyaltyRewardId` restent inchangés sur la ligne — cf.
    // `createCashierOrder` pour le même calcul à la création).
    const total = Math.max(
      0,
      computeItemsTotal(items) - (order.loyaltyDiscount ?? 0)
    );

    await tx.order.update({
      where: { id },
      data: { items: items as unknown as Prisma.InputJsonValue, total },
    });

    return { total };
  });
}
