// Mutations de commandes — fulfillment.

import prisma from '@/lib/prisma';
import type { OrderTypeInput } from '@/lib/schemas/order';
import { OrderMutationError } from './errors';
import { setOrderDriver } from './driver';

export type UpdateOrderFulfillmentInput = {
  orderType?: OrderTypeInput;
  pickupTime?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  note?: string | null;
};

export async function updateOrderFulfillment(
  id: string,
  input: UpdateOrderFulfillmentInput
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, driverName: true, driverPhone: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new OrderMutationError(
      'Commande terminée ou annulée : prise en charge non modifiable',
      409
    );
  }

  const hasDirectFields =
    input.orderType !== undefined ||
    input.pickupTime !== undefined ||
    input.note !== undefined;

  if (hasDirectFields) {
    const result = await prisma.order.updateMany({
      where: { id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      data: {
        ...(input.orderType !== undefined
          ? { orderType: input.orderType }
          : {}),
        ...(input.pickupTime !== undefined
          ? { pickupTime: input.pickupTime ? new Date(input.pickupTime) : null }
          : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
      },
    });
    if (result.count === 0) {
      throw new OrderMutationError(
        'État déjà modifié par un autre caissier',
        409
      );
    }
  }

  if (input.driverName !== undefined || input.driverPhone !== undefined) {
    await setOrderDriver(id, {
      driverName:
        input.driverName !== undefined ? input.driverName : order.driverName,
      driverPhone:
        input.driverPhone !== undefined ? input.driverPhone : order.driverPhone,
    });
  }
}
