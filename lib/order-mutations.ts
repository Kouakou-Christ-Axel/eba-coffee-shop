// lib/order-mutations.ts
//
// Logique de mutation des commandes « caisse / administration », partagée entre
// les routes API caisse, les server actions du dashboard et les outils MCP.
// Aucune de ces couches ne réimplémente la logique métier : elles branchent
// toutes les fonctions ci-dessous.
//
// Création (`createCashierOrder`) — différences avec `createOrder`
// (lib/orders.ts, flux online public) :
//   - `customerName` / `customerPhone` optionnels (commande anonyme possible)
//   - `orderType` libre (DELIVERY / DINE_IN / TAKEAWAY)
//   - `note` possible
//   - ANTIDATAGE : `orderDate` (YYYY-MM-DD) permet de rattacher la commande à un
//     jour civil passé. Absent = jour en cours. Le `createdAt` est alors aligné
//     sur ce jour pour conserver un tri chronologique cohérent dans l'historique.
//
// Statut (`setOrderStatus`) et paiement (`setOrderPayment`) : transitions
// validées (rôle / `canTransition`), concurrence optimiste, et auto-passage en
// cuisine (NEW → PREPARING) lors de l'encaissement d'une commande encore NEW.
//
// RÉSERVATION DE STOCK : elle a lieu à l'ENTRÉE EN CUISINE (et non plus à
// l'encaissement), car c'est là que la marchandise est réellement consommée —
// et parce qu'une commande peut partir en cuisine sans paiement (« ardoise »).
// Point d'entrée unique : `sendOrderToKitchen`. Le verrou d'idempotence est la
// colonne `Order.stockReservedAt` (cf. `reserveStockOnce`).
//
// COMMANDE DIFFÉRÉE (retrait un JOUR CIVIL ULTÉRIEUR, cf. `isDeferredPickup`,
// lib/orders/scheduling.ts) : elle ne consomme JAMAIS le stock d'aujourd'hui.
// La marchandise sera produite le jour du retrait, il serait donc faux de
// décompter aujourd'hui — c'est exactement ce qui empêchait de vendre pour
// demain un produit épuisé ce soir. Concrètement, deux chemins qui poussent
// normalement une commande en cuisine s'en abstiennent quand elle est différée :
// la création « ardoise » (`createCashierOrder`) et l'encaissement d'une
// commande encore NEW (`setOrderPayment`, qui redevient purement financier).
// Seul le geste humain `sendOrderToKitchen` réserve, le jour venu.
//
// Implémentation découpée par cas d'usage dans `lib/orders/mutations/`.
//
// CARTE PUBLIQUE : les mutations qui décrémentent ou restituent du stock sont
// exportées ENVELOPPÉES par `revalidatesPublicMenu` (lib/revalidate-public-menu.ts),
// qui invalide /carte, /api/menu et / une fois la mutation terminée. Les modules
// de `lib/orders/mutations/` s'appellent entre eux sans passer par ce fichier :
// une seule invalidation par appel externe. Une nouvelle mutation qui touche au
// stock s'exporte ici avec l'enveloppe, jamais avec un `revalidatePath` chez
// l'appelant.

export {
  OrderMutationError,
  StockShortageError,
} from './orders/mutations/errors';
export {
  getOrderShortage,
  getItemsShortage,
  buildShortagePayload,
} from './orders/mutations/shortage';
export type { ShortagePayload } from './orders/mutations/shortage';
export {
  releaseUnpaidStockHold,
  reserveStockOnce,
} from './orders/mutations/stock-reservation';
export type { CreateCashierOrderInput } from './orders/mutations/types';
export { buildOrderItemsFromMenu } from './orders/mutations/build-items';
export type { OrderItemRef } from './orders/mutations/build-items';
export { recordDeposit } from './orders/mutations/deposit';
export { updateOrderDetails } from './orders/mutations/details';
export { setOrderCustomer } from './orders/mutations/customer';
export { setOrderLoyaltyReward } from './orders/mutations/loyalty';
export { setOrderDriver } from './orders/mutations/driver';
export { updateOrderFulfillment } from './orders/mutations/fulfillment';
export type { UpdateOrderFulfillmentInput } from './orders/mutations/fulfillment';

import { createCashierOrder as createCashierOrderImpl } from './orders/mutations/create-cashier-order';
import { sendOrderToKitchen as sendOrderToKitchenImpl } from './orders/mutations/kitchen';
import { setOrderStatus as setOrderStatusImpl } from './orders/mutations/status';
import { setOrderPayment as setOrderPaymentImpl } from './orders/mutations/payment';
import { payAndComplete as payAndCompleteImpl } from './orders/mutations/pay-and-complete';
import { updateOrderItems as updateOrderItemsImpl } from './orders/mutations/items';
import { revalidatesPublicMenu } from './revalidate-public-menu';

/** Seule une commande envoyée en cuisine à la création réserve son stock. */
export const createCashierOrder = revalidatesPublicMenu(
  createCashierOrderImpl,
  (_args, order) => order.stockReservedAt != null
);
export const sendOrderToKitchen = revalidatesPublicMenu(sendOrderToKitchenImpl);
/** Cuisine (réservation), annulation et reprise (parts rendues / reprises). */
export const setOrderStatus = revalidatesPublicMenu(
  setOrderStatusImpl,
  ([, status]) =>
    status === 'PREPARING' || status === 'CANCELLED' || status === 'NEW'
);
export const setOrderPayment = revalidatesPublicMenu(setOrderPaymentImpl);
export const payAndComplete = revalidatesPublicMenu(payAndCompleteImpl);
export const updateOrderItems = revalidatesPublicMenu(updateOrderItemsImpl);
