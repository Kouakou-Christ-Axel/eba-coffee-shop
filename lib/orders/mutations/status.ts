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

/** Fait transitionner une commande vers `newStatus`. */
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

  if (order.status === 'CANCELLED' && newStatus === 'NEW' && order.isPaid) {
    throw new OrderMutationError(
      'Commande remboursée : impossible de la remettre à encaisser',
      409
    );
  }

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

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, status: order.status },
      data: {
        status: newStatus,
        ...(newStatus === 'READY' ? { readyAt: new Date() } : {}),
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
