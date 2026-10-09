// lib/orders/mutations/kitchen.ts
//
// Mutations de commandes — kitchen (extrait de lib/order-mutations.ts, sans changement de comportement).

import type { UserRole } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import { canTransition } from '@/lib/order-permissions';
import type { CartItem } from '@/lib/cart-store';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { notifyKitchen } from './notify';
import { OrderMutationError, StockShortageError } from './errors';
import {
  reserveStockOnce,
  notifyPendingOrdersOfShortage,
} from './stock-reservation';

// ─── Entrée en cuisine (point d'entrée UNIQUE de la réservation de stock) ─────

/**
 * Envoie une commande en cuisine (→ `PREPARING`) et RÉSERVE son stock, une
 * seule fois. C'est le seul endroit du code où une commande entre en cuisine :
 * `setOrderStatus(id, 'PREPARING', role)` y délègue, `setOrderPayment` en
 * reprend la mécanique quand l'encaissement pousse une commande NEW en
 * cuisine, et l'écran cuisine passe par `setOrderStatus`.
 *
 * `opts.onAccount` : envoi « ardoise », c'est-à-dire SANS encaissement (client
 * de confiance ou dérogation caissier). Ce n'est pas un paiement : `isPaid`
 * reste `false`, seul `isOnAccount` est posé.
 *
 * POURQUOI l'annulation NE LIBÈRE PAS la réservation (aucune ré-incrémentation,
 * ici comme dans `setOrderStatus` / le dépaiement) :
 *   1. cela préserve l'invariant « décrémenté au plus une fois, jamais
 *      ré-incrémenté », qui rend TOUS les chemins d'undo sûrs par construction
 *      (undo `PREPARING → NEW` puis renvoi en cuisine, reprise d'une commande
 *      annulée, encaissement après coup…) ;
 *   2. un plat annulé en cours de préparation est de toute façon perdu ;
 *   3. libérer ferait échouer `CANCELLED → PREPARING` avec un 409 sur ce que
 *      l'interface présente comme un simple undo.
 * Le réapprovisionnement explicite existe déjà par ailleurs
 * (`/api/caisse/restock`).
 *
 * `opts.coverShortage` : le staff a confirmé à l'écran avoir produit la
 * quantité manquante — on la crédite avant de réserver (effet net nul, cf.
 * `coverShortageForOrderItems`). Jamais un défaut : sans cette confirmation,
 * une pénurie reste un refus.
 *
 * La réservation est INCONDITIONNELLE ici, y compris pour une commande dont le
 * retrait est un jour ultérieur : c'est un geste humain délibéré, et préparer
 * la veille est un usage légitime. Ce sont les chemins AUTOMATIQUES (ardoise à
 * la création, encaissement d'une NEW) qui s'abstiennent — voir l'en-tête de
 * fichier.
 *
 * Lève `OrderMutationError` (404 introuvable, 403 transition refusée, 409
 * conflit de concurrence) ou `StockShortageError` (409 — le client est alors
 * notifié `ITEM_UNAVAILABLE` avant que l'erreur ne remonte).
 */
export async function sendOrderToKitchen(
  id: string,
  role: UserRole,
  opts?: { onAccount?: boolean; coverShortage?: boolean }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      items: true,
      dailyNumber: true,
      reference: true,
      depositRequired: true,
      depositPaid: true,
    },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }

  if (!canTransition(order.status, 'PREPARING', role)) {
    throw new OrderMutationError(
      `Transition non autorisée : ${order.status} → PREPARING`,
      403
    );
  }

  // Commande spéciale à l'avance (cf. Product.requiresDeposit) : n'entre en
  // cuisine — donc n'est « prise en compte » — qu'une fois l'acompte minimum
  // versé. Seul verrou de ce genre : un règlement intégral (setOrderPayment,
  // payAndComplete) couvre toujours l'acompte, puisqu'il couvre le total.
  if (
    order.depositRequired &&
    (order.depositPaid ?? 0) < order.depositRequired
  ) {
    const remaining = order.depositRequired - (order.depositPaid ?? 0);
    throw new OrderMutationError(
      `Acompte requis avant l'entrée en cuisine : ${remaining} F restant sur ${order.depositRequired} F.`,
      409
    );
  }

  const items = order.items as unknown as CartItem[];

  let reserved: boolean;
  try {
    reserved = await prisma.$transaction(async (tx) => {
      // Réservation AVANT l'écriture du statut : une pénurie fait échouer la
      // transaction entière, la commande reste donc là où elle était.
      const claimed = await reserveStockOnce(tx, id, items, {
        coverShortage: opts?.coverShortage,
      });

      const result = await tx.order.updateMany({
        where: { id, status: order.status },
        data: {
          status: 'PREPARING',
          preparingStartedAt: new Date(),
          ...(opts?.onAccount ? { isOnAccount: true } : {}),
        },
      });
      if (result.count === 0) {
        throw new OrderMutationError(
          'État déjà modifié par un autre caissier',
          409
        );
      }

      return claimed;
    });
  } catch (err) {
    if (err instanceof StockShortageError) {
      // Client perdant (stock insuffisant) : notifié AVANT que la 409 ne
      // remonte à l'appelant — best-effort, jamais bloquant.
      notifyOrderCustomer(id, 'ITEM_UNAVAILABLE');
    }
    throw err;
  }

  notifyOrderCustomer(id, 'PREPARING');
  notifyKitchen({
    id,
    dailyNumber: order.dailyNumber,
    reference: order.reference,
    items,
  });

  // Fan-out uniquement si CET appel a réellement décrémenté : une ré-entrée en
  // cuisine (après undo) ne change rien au stock, donc rien à annoncer.
  if (reserved) {
    notifyPendingOrdersOfShortage(id, items).catch((err) => {
      console.error('[order-mutations] fan-out stock épuisé échoué :', err);
    });
  }
}
