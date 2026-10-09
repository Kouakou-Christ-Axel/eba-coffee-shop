// lib/orders/mutations/stock-resync.ts
//
// Mutations de commandes — stock-resync (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import type { CartItem } from '@/lib/cart-store';
import { StockShortageError } from './errors';
import { aggregateStockNeeds } from './stock-needs';

/**
 * Crédite EXACTEMENT la quantité manquante de chaque cible suivie, dans la
 * transaction qui va réserver. La réservation la redescend immédiatement :
 * effet net nul sur le stock, et la commande passe.
 *
 * Geste explicite : n'est jamais appelée sans que quelqu'un ait répondu « oui,
 * je les ai produits » à l'écran.
 */
/**
 * Réaligne le stock après une MODIFICATION du contenu d'une commande DÉJÀ
 * RÉSERVÉE : décrémente ce qui vient d'être ajouté, recrédite ce qui vient
 * d'être retiré. Le delta est calculé entre les articles PERSISTÉS et les
 * nouveaux, donc rejouer deux fois la même modification ne crédite qu'une fois
 * — l'idempotence vient de l'état, pas d'un verrou.
 *
 * Ce n'est PAS une entorse à l'invariant « jamais ré-incrémenté » de
 * `sendOrderToKitchen` : cet invariant porte sur les changements de STATUT
 * (annulation, dépaiement), où le plat est perdu et où l'undo doit rester sûr.
 * Ici on parle du CONTENU : un article retiré d'une commande vivante n'a pas
 * été consommé, le laisser décompté fait mentir le stock et bloque une vente
 * réelle. Deux règles distinctes, pour deux gestes distincts.
 *
 * `restoreRemoved: false` : le staff a indiqué que l'article retiré était déjà
 * préparé (commande en cuisine) — on ne recrédite alors rien, les ajouts
 * restent décomptés.
 *
 * `coverShortage` : même geste explicite que sur `reserveStockOnce` (le staff
 * a confirmé avoir produit le manque) — crédite exactement ce qu'il manque
 * pour couvrir le delta AVANT de décrémenter, plutôt que de refuser l'édition
 * et pousser à annuler/recréer la commande.
 */
export async function resyncStockForItemChange(
  tx: Prisma.TransactionClient,
  previousItems: CartItem[],
  nextItems: CartItem[],
  restoreRemoved: boolean,
  coverShortage = false
): Promise<void> {
  const before = await aggregateStockNeeds(tx, previousItems);
  const after = await aggregateStockNeeds(tx, nextItems);

  for (const id of new Set([
    ...before.products.keys(),
    ...after.products.keys(),
  ])) {
    const delta =
      (after.products.get(id)?.needed ?? 0) -
      (before.products.get(id)?.needed ?? 0);
    if (delta === 0) continue;
    const name =
      after.products.get(id)?.name ?? before.products.get(id)?.name ?? id;
    if (delta > 0) {
      if (coverShortage) {
        const row = await tx.product.findUnique({
          where: { id },
          select: { stockQuantity: true },
        });
        if (row && row.stockQuantity !== null && row.stockQuantity < delta) {
          await tx.product.update({
            where: { id },
            data: { stockQuantity: { increment: delta - row.stockQuantity } },
          });
        }
      }
      const res = await tx.product.updateMany({
        where: {
          id,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
        },
        data: { stockQuantity: { decrement: delta } },
      });
      if (res.count !== 1) {
        throw new StockShortageError(`Stock insuffisant pour « ${name} »`);
      }
    } else if (restoreRemoved) {
      // `NULL + n = NULL` : une cible à stock illimité reste illimitée.
      await tx.product.update({
        where: { id },
        data: { stockQuantity: { increment: -delta } },
      });
    }
  }

  for (const id of new Set([
    ...before.options.keys(),
    ...after.options.keys(),
  ])) {
    const delta =
      (after.options.get(id)?.needed ?? 0) -
      (before.options.get(id)?.needed ?? 0);
    if (delta === 0) continue;
    const need = after.options.get(id) ?? before.options.get(id);
    if (delta > 0) {
      if (coverShortage) {
        const row = await tx.supplementOption.findUnique({
          where: { id },
          select: { stockQuantity: true },
        });
        if (row && row.stockQuantity !== null && row.stockQuantity < delta) {
          await tx.supplementOption.update({
            where: { id },
            data: { stockQuantity: { increment: delta - row.stockQuantity } },
          });
        }
      }
      const res = await tx.supplementOption.updateMany({
        where: {
          id,
          OR: [{ stockQuantity: null }, { stockQuantity: { gte: delta } }],
        },
        data: { stockQuantity: { decrement: delta } },
      });
      if (res.count !== 1) {
        throw new StockShortageError(
          `Stock insuffisant pour « ${need?.productName} — ${need?.optionName} »`
        );
      }
    } else if (restoreRemoved) {
      await tx.supplementOption.update({
        where: { id },
        data: { stockQuantity: { increment: -delta } },
      });
    }
  }

  // Options introuvables (renommées/désactivées entre la réservation et cette
  // édition) : sans ce contrôle, une quantité ajoutée sur une telle option ne
  // serait décomptée nulle part, puisqu'elle n'apparaît dans AUCUNE des deux
  // maps `options` ci-dessus — cf. le commentaire d'`aggregateStockNeeds`.
  for (const key of new Set([
    ...before.unresolved.keys(),
    ...after.unresolved.keys(),
  ])) {
    const need = after.unresolved.get(key);
    const delta =
      (need?.needed ?? 0) - (before.unresolved.get(key)?.needed ?? 0);
    if (delta > 0 && need) {
      throw new StockShortageError(
        `Option indisponible pour « ${need.productName} — ${need.optionName} »`
      );
    }
  }
}
