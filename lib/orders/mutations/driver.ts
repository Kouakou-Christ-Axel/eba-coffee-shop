// Mutations de commandes — driver.

import prisma from '@/lib/prisma';
import { normalizeIvorianPhone } from '@/lib/phone';
import { OrderMutationError } from './errors';

/** Renseigne, modifie ou efface (les deux champs à null) le livreur envoyé par le client. */
export async function setOrderDriver(
  id: string,
  input: { driverName: string | null; driverPhone: string | null }
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new OrderMutationError(
      'Commande terminée ou annulée : livreur non modifiable',
      409
    );
  }

  const driverPhone = input.driverPhone
    ? (normalizeIvorianPhone(input.driverPhone) ?? input.driverPhone)
    : null;

  const result = await prisma.order.updateMany({
    where: { id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    data: { driverName: input.driverName, driverPhone },
  });
  if (result.count === 0) {
    throw new OrderMutationError(
      'État déjà modifié par un autre caissier',
      409
    );
  }
}
