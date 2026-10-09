// Mutations de commandes — status.

import type { OrderStatus, UserRole } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import {
  restoreLoyaltyForOrder,
  revokeLoyaltyForOrder,
} from '@/lib/loyalty-mutations';
import { getOrderLoyaltyOutcome } from '@/lib/loyalty';
import { getLoyaltySettings } from '@/lib/loyalty-settings-db';
import { computePickupMessage } from '@/lib/loyalty-messaging';
import { canTransition } from '@/lib/order-permissions';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { notifyOrderCustomer } from '@/lib/push-notify';
import { notifyPush } from './notify';
import { OrderMutationError } from './errors';
import { sendOrderToKitchen } from './kitchen';

// ─── Changement de statut ─────────────────────────────────────────────────────

/**
 * Fait transitionner une commande vers `newStatus`. Vérifie l'autorisation
 * (`canTransition` selon le rôle) et applique une concurrence optimiste : la
 * mise à jour n'a lieu que si le statut courant n'a pas changé entre temps.
 *
 * Cible `PREPARING` : délègue intégralement à `sendOrderToKitchen`, qui réserve
 * le stock. Aucune autre cible ne touche au stock (une annulation ne libère
 * JAMAIS la réservation — voir `sendOrderToKitchen` pour le pourquoi).
 *
 * Lève `OrderMutationError` (404 introuvable, 403 transition refusée, 409
 * conflit) ou `StockShortageError` (409, uniquement vers `PREPARING`) — à
 * mapper en réponse HTTP par les routes.
 */
export async function setOrderStatus(
  id: string,
  newStatus: OrderStatus,
  role: UserRole,
  opts?: { coverShortage?: boolean }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      dailyNumber: true,
      customerId: true,
      isPaid: true,
      total: true,
      loyaltyRewardId: true,
    },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }

  if (!canTransition(order.status, newStatus, role)) {
    throw new OrderMutationError(
      `Transition non autorisée : ${order.status} → ${newStatus}`,
      403
    );
  }

  // Entrée en cuisine : un seul point d'entrée, qui réserve le stock (voir
  // `sendOrderToKitchen`). La validation de rôle vient d'avoir lieu ci-dessus,
  // `sendOrderToKitchen` la refait — c'est volontairement redondant : elle
  // reste ainsi correcte quand elle est appelée directement (ardoise).
  if (newStatus === 'PREPARING') {
    await sendOrderToKitchen(id, role, {
      coverShortage: opts?.coverShortage,
    });
    // Reprise d'une commande annulée : son tampon lui revient.
    if (order.status === 'CANCELLED' && order.customerId) {
      const customerId = order.customerId;
      await prisma.$transaction((tx) =>
        restoreLoyaltyForOrder(tx, {
          orderId: id,
          customerId,
          orderTotal: order.total,
        })
      );
    }
    return;
  }

  // Remettre une commande ANNULÉE « à encaisser » n'a de sens que si elle n'a
  // jamais été encaissée : une annulation après paiement vaut remboursement,
  // et la replacer en NEW réclamerait un second encaissement du même montant.
  // Seule la cible NEW est bloquée : CANCELLED → READY/COMPLETED reste
  // disponible pour défaire un remboursement déclenché par erreur.
  if (order.status === 'CANCELLED' && newStatus === 'NEW' && order.isPaid) {
    throw new OrderMutationError(
      'Commande remboursée : impossible de la remettre à encaisser',
      409
    );
  }

  // Reconnaissance fidélité combinée à la confirmation « commande prête » :
  // calculée AVANT le `updateMany` (le tampon a déjà été attribué à la
  // création, cf. `awardLoyaltyForOrder` — on ne fait ici que relire ce qui a
  // été tracé au ledger, jamais de nouvelle attribution).
  let readyBodyOverride: string | undefined;
  if (newStatus === 'READY' && order.customerId) {
    const [settings, outcome] = await Promise.all([
      getLoyaltySettings(),
      getOrderLoyaltyOutcome(order.customerId, id),
    ]);
    if (outcome) {
      readyBodyOverride = computePickupMessage({ settings, ...outcome });
    }
  }

  // Fidélité, dans la MÊME transaction que le changement de statut :
  //   - annulation → le tampon gagné par la commande est retiré (sinon
  //     « commander puis faire annuler » fabriquerait des tampons). La
  //     récompense appliquée reste sur la commande (`keepUsedReward`) : elle a
  //     pu être encaissée avec cette remise, et l'annulation peut être défaite ;
  //   - reprise d'une commande annulée → le tampon est rendu.
  // Les deux sont idempotents (solde de tampons de la commande au ledger).
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, status: order.status },
      data: {
        status: newStatus,
        // Horodatage du minuteur « prête depuis X ». L'amorce du chrono « en
        // cuisine depuis X » (`preparingStartedAt`) vit dans
        // `sendOrderToKitchen`, seul chemin vers PREPARING (voir le court-circuit
        // ci-dessus).
        ...(newStatus === 'READY' ? { readyAt: new Date() } : {}),
        // Retour en NEW (undo d'une mise en cuisine, ou reprise d'une commande
        // annulée) : on remet les minuteurs à zéro. Sinon la commande revient
        // avec un « en cuisine depuis 3 h » périmé et, pire, pollue la clé de tri
        // FIFO cuisine (`preparingStartedAt`, cf. lib/orders/queue-order.ts) dès
        // sa prochaine entrée en cuisine.
        ...(newStatus === 'NEW'
          ? { preparingStartedAt: null, readyAt: null }
          : {}),
      },
    });
    if (updated.count > 0 && order.customerId) {
      if (newStatus === 'CANCELLED') {
        await revokeLoyaltyForOrder(tx, {
          orderId: id,
          customerId: order.customerId,
          usedRewardId: order.loyaltyRewardId,
          note: 'Commande annulée par le staff',
          keepUsedReward: true,
        });
      } else if (order.status === 'CANCELLED') {
        await restoreLoyaltyForOrder(tx, {
          orderId: id,
          customerId: order.customerId,
          orderTotal: order.total,
        });
      }
    }
    return updated;
  });

  if (result.count === 0) {
    throw new OrderMutationError(
      'État déjà modifié par un autre caissier',
      409
    );
  }

  // La caisse remet la commande au client : on l'alerte quand elle est prête.
  if (newStatus === 'READY') {
    notifyPush(ROLE_GROUPS.CASHIER_PLUS, {
      title: 'Commande prête',
      body: `#${order.dailyNumber} prête à récupérer`,
      url: '/dashboard/caisse',
      tag: `order-ready-${id}`,
    });
  }

  // Client abonné depuis la page de suivi : chaque étape le concerne
  // (préparation, prête, récupérée, annulée). NEW n'est jamais une cible ici.
  if (newStatus !== 'NEW') {
    notifyOrderCustomer(id, newStatus, readyBodyOverride);
  }
}
