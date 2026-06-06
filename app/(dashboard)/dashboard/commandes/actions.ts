'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { canTransition } from '@/lib/order-permissions';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
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

  if (items.length === 0)
    throw new Error('La commande doit avoir au moins un article');

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
    throw new Error('Impossible de modifier une commande terminée ou annulée');
  }

  // Plafond de remise par ligne (sécurité serveur, en plus de la validation UI).
  for (const item of items) {
    if ((item.discount ?? 0) > getMaxItemDiscount(item)) {
      throw new Error(`Remise trop élevée sur « ${item.productName} »`);
    }
  }

  // Total net recalculé côté serveur (après remises).
  const total = computeItemsTotal(items);

  await prisma.order.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { items: items as any, total },
  });

  revalidatePath(`/dashboard/commandes/${id}`);
}
