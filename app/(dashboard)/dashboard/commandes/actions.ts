'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { OrderStatus } from '@/generated/prisma';

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP'],
  PICKED_UP: [],
  CANCELLED: [],
};

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    throw new Error('Commande introuvable');
  }

  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Transition invalide : ${order.status} → ${newStatus}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: newStatus },
  });
}
