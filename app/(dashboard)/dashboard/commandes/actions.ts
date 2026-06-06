'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { canTransition } from '@/lib/order-permissions';
import type { CartItem } from '@/lib/cart-store';
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

export async function updateOrderItemsAction(
  id: string,
  items: CartItem[]
): Promise<void> {
  await requireCashier();

  if (items.length === 0) throw new Error('La commande doit avoir au moins un article');

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new Error('Impossible de modifier une commande terminée ou annulée');
  }

  const total = items.reduce(
    (sum, item) =>
      sum +
      (item.basePrice +
        item.supplements.reduce((s, sup) => s + sup.price, 0)) *
        item.quantity,
    0
  );

  await prisma.order.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { items: items as any, total },
  });

  revalidatePath(`/dashboard/commandes/${id}`);
}
