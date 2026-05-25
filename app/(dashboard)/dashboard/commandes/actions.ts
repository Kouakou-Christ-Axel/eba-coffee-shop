'use server';

import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { canTransition } from '@/lib/order-permissions';
import type { OrderStatus, UserRole } from '@/generated/prisma/client';

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<void> {
  const session = await requireCashier();
  const role = session.user.role as UserRole;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new Error('Commande introuvable');
  }

  if (!canTransition(order.status, newStatus, role)) {
    throw new Error(`Transition invalide : ${order.status} → ${newStatus}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: newStatus },
  });
}
