// lib/orders/mutations/stock-reservation.ts
//
// Mutations de commandes — stock-reservation (extrait de lib/order-mutations.ts, sans changement de comportement).

import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { fetchStockSnapshot, optionKey } from '@/lib/orders/availability';
import { isDeferredPickup } from '@/lib/orders/scheduling';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { decrementStockForOrderItems } from './stock-needs';
import { resyncStockForItemChange } from './stock-resync';
import { coverShortageForOrderItems } from './shortage';

/**
 * Restitue intégralement le stock tenu par `items` — réutilise
 * `resyncStockForItemChange` avec une cible vide, qui ne fait alors que
 * recréditer, rien à décrémenter.
 *
 * UNIQUE appelante : `expirePendingOrders` (lib/jeko/expiry.ts), pour une
 * commande en ligne du jour jamais payée dont `reserveStockOnce` avait
 * réservé le stock dès la création (voir son commentaire). Ce n'est PAS une
 * entorse à l'irréversibilité de `stockReservedAt` décrite plus haut : cette
 * irréversibilité protège une commande déjà COMMISE en cuisine (« le plat est
 * perdu », cf. le commentaire de `resyncStockForItemChange`) — ici, le
 * paiement n'a jamais abouti, rien n'a jamais été préparé, il n'y a rien à
 * perdre à rendre le stock et à redescendre `stockReservedAt` à `null`. À ne
 * jamais appeler ailleurs que depuis ce chemin d'expiration.
 */
export function releaseUnpaidStockHold(
  tx: Prisma.TransactionClient,
  items: CartItem[]
): Promise<void> {
  return resyncStockForItemChange(tx, items, [], true);
}

/**
 * Réserve (décrémente) le stock d'une commande AU PLUS UNE FOIS, quel que soit
 * le nombre de chemins qui y mènent. Renvoie `true` si CET appel a réellement
 * décrémenté, `false` si la réservation avait déjà eu lieu.
 *
 * Le statut ne peut pas servir de témoin : plusieurs chemins mènent en cuisine,
 * plusieurs transitions sont réversibles (undo `PREPARING → NEW`, reprise
 * `CANCELLED → NEW` puis renvoi en cuisine) et `payAndComplete` fait
 * NEW → COMPLETED sans jamais passer par PREPARING. D'où la colonne dédiée
 * `Order.stockReservedAt`.
 *
 * ORDRE IMPÉRATIF — on REVENDIQUE le verrou AVANT de décrémenter, via un
 * `UPDATE ... WHERE stockReservedAt IS NULL` conditionnel, et JAMAIS via un
 * `findUnique` suivi d'un test en mémoire : sous READ COMMITTED, deux
 * transactions concurrentes qui émettent le même `updateMany` conditionnel se
 * sérialisent sur le verrou de ligne, et la seconde ré-évalue le prédicat
 * après le commit de la première — elle obtient donc `count = 0`. Un
 * lire-puis-tester laisserait au contraire passer les deux (les deux lectures
 * voient `null` avant toute écriture). C'est exactement la technique déjà
 * employée par `decrementStockForOrderItems` (garde `stockQuantity >= besoin`)
 * et par la garde optimiste de `setOrderStatus`.
 *
 * Une pénurie lève `StockShortageError` APRÈS la revendication : le rollback
 * de la transaction annule aussi la pose du verrou, donc rien n'est perdu.
 *
 * `coverShortage` (geste explicite du staff, jamais un défaut) crédite d'abord
 * le manque : la réservation qui suit le redescend, effet net nul.
 *
 * Second appelant depuis ce chantier : `createOrder` (lib/orders.ts), pour une
 * commande en ligne du jour même — réserve dès la création, le temps de la
 * fenêtre de paiement, pour qu'un client au comptoir ne vende pas entre-temps
 * l'article qu'un paiement en ligne est en train d'honorer. Si ce paiement
 * n'arrive jamais, `releaseUnpaidStockHold` (ci-dessous) est l'UNIQUE endroit
 * autorisé à redescendre `stockReservedAt` à `null` : voir son commentaire
 * pour pourquoi ce cas précis n'entre pas en contradiction avec l'irréversibilité
 * du verrou décrite ci-dessus.
 */
export async function reserveStockOnce(
  tx: Prisma.TransactionClient,
  orderId: string,
  items: CartItem[],
  opts?: { coverShortage?: boolean }
): Promise<boolean> {
  const claim = await tx.order.updateMany({
    where: { id: orderId, stockReservedAt: null },
    data: { stockReservedAt: new Date() },
  });
  if (claim.count === 0) return false;

  // AVANT le décrément, et seulement sur demande explicite : le staff a
  // confirmé avoir produit la quantité manquante.
  if (opts?.coverShortage) {
    await coverShortageForOrderItems(tx, items);
  }

  await decrementStockForOrderItems(tx, items);
  return true;
}

// ─── Fan-out best-effort : commandes en attente affectées ─────────────────────
//
// APRÈS commit seulement (jamais dans la transaction qui réserve) : si la
// réservation qui vient de réussir a fait tomber un produit/option à 0, les
// autres commandes dont le stock n'est PAS encore réservé et qui en dépendent
// ne pourront plus être honorées telles quelles — on les avertit sans attendre
// le prochain polling/SSE. Fire-and-forget : un échec ici ne doit jamais
// remonter (la réservation, elle, a déjà réussi).
//
// Candidates = `stockReservedAt: null` (et non `isPaid: false`) : une commande
// impayée déjà partie en cuisine a son stock réservé, elle n'est donc pas en
// danger et ne doit surtout pas recevoir un « article indisponible ».
//
// Les commandes DIFFÉRÉES sont écartées pour la même raison, l'autre bout :
// leur marchandise sera produite le jour du retrait, le stock d'aujourd'hui ne
// les concerne pas. Sans ce filtre, un client dont la commande est pour samedi
// recevrait « article indisponible » chaque fois qu'un produit tombe à 0 un
// jour de semaine.
export async function notifyPendingOrdersOfShortage(
  reservedOrderId: string,
  reservedItems: CartItem[]
): Promise<void> {
  const now = new Date();
  const snapshot = await fetchStockSnapshot([reservedItems]);

  const zeroedProductIds = new Set(
    [...snapshot.products.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([id]) => id)
  );
  const zeroedOptionKeys = new Set(
    [...snapshot.options.entries()]
      .filter(([, qty]) => qty === 0)
      .map(([key]) => key)
  );
  if (zeroedProductIds.size === 0 && zeroedOptionKeys.size === 0) return;

  // staff-visibility: exempt — prévient aussi les clients en cours de paiement qu'un produit de leur commande vient de s'épuiser
  const candidates = await prisma.order.findMany({
    where: {
      id: { not: reservedOrderId },
      stockReservedAt: null,
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: { id: true, items: true, pickupTime: true },
    take: 200,
  });

  for (const candidate of candidates) {
    if (isDeferredPickup(candidate.pickupTime, now)) continue;
    const items = candidate.items as unknown as CartItem[];
    const affected = items.some((item) => {
      if (zeroedProductIds.has(item.productId)) return true;
      return item.supplements.some((s) =>
        zeroedOptionKeys.has(
          optionKey(item.productId, s.groupName, s.optionName)
        )
      );
    });
    if (affected) {
      notifyOrderCustomer(candidate.id, 'ITEM_UNAVAILABLE');
    }
  }
}
