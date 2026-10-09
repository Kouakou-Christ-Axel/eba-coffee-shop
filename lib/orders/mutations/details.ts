// Mutations de commandes — details.

import prisma from '@/lib/prisma';
import { updateOrderDetailsSchema } from '@/lib/schemas/order';
import { OrderMutationError } from './errors';

export async function updateOrderDetails(id: string, input: unknown) {
  const data = updateOrderDetailsSchema.parse(input);

  const order = await prisma.order.findUnique({
    where: { id },
    select: { isPaid: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (data.paymentMode === null && order.isPaid) {
    throw new OrderMutationError(
      'Impossible de retirer le mode de paiement d’une commande payée',
      400
    );
  }

  return prisma.order.update({
    where: { id },
    data: {
      ...(data.orderType !== undefined ? { orderType: data.orderType } : {}),
      ...(data.pickupTime !== undefined
        ? { pickupTime: data.pickupTime ? new Date(data.pickupTime) : null }
        : {}),
      ...(data.paymentMode !== undefined
        ? { paymentMode: data.paymentMode }
        : {}),
      ...(data.note !== undefined ? { note: data.note ?? null } : {}),
    },
  });
}
