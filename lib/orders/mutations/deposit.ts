// Mutations de commandes — deposit.

import prisma from '@/lib/prisma';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';
import { OrderMutationError } from './errors';

/** Enregistre un versement d'acompte sur une commande qui en exige un. */
export async function recordDeposit(
  id: string,
  payments: OrderPaymentLineInput[],
  actorId?: string | null
): Promise<{ depositPaid: number; depositRequired: number }> {
  if (!payments || payments.length === 0) {
    throw new OrderMutationError('payments requis', 400);
  }
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  if (sum <= 0) {
    throw new OrderMutationError('Montant invalide', 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      total: true,
      isPaid: true,
      depositRequired: true,
      depositPaid: true,
    },
  });
  if (!order) {
    throw new OrderMutationError('Commande introuvable', 404);
  }
  if (!order.depositRequired) {
    throw new OrderMutationError("Cette commande n'exige pas d'acompte", 400);
  }
  if (order.isPaid) {
    throw new OrderMutationError('Commande déjà soldée', 409);
  }

  const currentPaid = order.depositPaid ?? 0;
  const newPaid = currentPaid + sum;
  if (newPaid > order.total) {
    throw new OrderMutationError(
      `Le montant dépasse le solde restant (${order.total - currentPaid} F)`,
      400
    );
  }

  const [result] = await prisma.$transaction([
    prisma.order.updateMany({
      where: { id, depositPaid: currentPaid, isPaid: false },
      data: { depositPaid: newPaid, depositPaidAt: new Date() },
    }),
    prisma.orderPayment.createMany({
      data: payments.map((p) => ({
        orderId: id,
        mode: p.mode,
        amount: p.amount,
        createdById: actorId ?? null,
      })),
    }),
  ]);
  if (result.count === 0) {
    throw new OrderMutationError('État modifié entre temps, recharger', 409);
  }

  return { depositPaid: newPaid, depositRequired: order.depositRequired };
}
