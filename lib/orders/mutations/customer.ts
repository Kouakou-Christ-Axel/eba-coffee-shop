// Mutations de commandes — customer.

import prisma from '@/lib/prisma';
import { upsertCustomerForOrder } from '@/lib/customer-mutations';
import { awardLoyaltyForOrder } from '@/lib/loyalty-mutations';
import { normalizeIvorianPhone } from '@/lib/phone';
import { OrderMutationError } from './errors';

/** Associe (ou détache) un client à une commande déjà créée. */
export async function setOrderCustomer(
  orderId: string,
  input: {
    customerId?: string | null;
    phone?: string | null;
    name?: string | null;
  },
  actorId?: string | null
): Promise<{ customerId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, customerName: true, total: true },
    });
    if (!order) {
      throw new OrderMutationError('Commande introuvable', 404);
    }

    if (input.customerId === null && !input.phone) {
      const result = await tx.order.updateMany({
        where: { id: orderId, customerId: order.customerId },
        data: { customerId: null },
      });
      if (result.count === 0) {
        throw new OrderMutationError(
          'Client déjà modifié entre-temps, recharger',
          409
        );
      }
      return { customerId: null };
    }

    let customerId: string;
    let customerName: string | null;
    let customerPhone: string | null;

    if (input.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, name: true, phone: true },
      });
      if (!customer) {
        throw new OrderMutationError('Client introuvable', 404);
      }
      customerId = customer.id;
      customerName = customer.name ?? order.customerName ?? null;
      customerPhone = customer.phone;
    } else if (input.phone) {
      const rawPhone = input.phone.trim();
      const normalizedPhone = normalizeIvorianPhone(rawPhone) ?? rawPhone;
      const upsertedId = await upsertCustomerForOrder(
        tx,
        normalizedPhone,
        input.name
      );
      if (!upsertedId) {
        throw new OrderMutationError('Téléphone invalide', 400);
      }
      customerId = upsertedId;
      customerPhone = normalizedPhone;
      const cleanName = input.name?.trim() || null;
      if (cleanName) {
        customerName = cleanName;
      } else {
        const c = await tx.customer.findUnique({
          where: { id: upsertedId },
          select: { name: true },
        });
        customerName = c?.name ?? order.customerName ?? null;
      }
    } else {
      throw new OrderMutationError('customerId ou téléphone requis', 400);
    }

    const wasAnonymous = order.customerId === null;

    const result = await tx.order.updateMany({
      where: { id: orderId, customerId: order.customerId },
      data: { customerId, customerName, customerPhone },
    });
    if (result.count === 0) {
      throw new OrderMutationError(
        'Client déjà modifié entre-temps, recharger',
        409
      );
    }

    // Fidélité : on tamponne comme à la création, seulement si la commande
    // était anonyme (pas de double-comptage sur une ré-affectation).
    if (wasAnonymous) {
      await awardLoyaltyForOrder(tx, {
        customerId,
        orderId,
        orderTotal: order.total,
        actorId: actorId ?? null,
      });
    }

    return { customerId };
  });
}
