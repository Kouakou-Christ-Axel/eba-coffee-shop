'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { endOfDay, startOfDay } from 'date-fns';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import type { CartItem } from '@/lib/cart-store';

export type PreparationOrder = {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  pickupTime: Date;
  items: CartItem[];
  note: string | null;
  total: number;
  status: 'PENDING' | 'CONFIRMED';
};

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé');
  }
}

export async function getPreparationQueue(): Promise<PreparationOrder[]> {
  await requireAdmin();

  const now = new Date();
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      pickupTime: {
        gte: startOfDay(now),
        lte: endOfDay(now),
      },
    },
    orderBy: { pickupTime: 'asc' },
  });

  return orders.map((o) => ({
    id: o.id,
    reference: o.reference,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    pickupTime: o.pickupTime,
    items: o.items as CartItem[],
    note: o.note,
    total: o.total,
    status: o.status as 'PENDING' | 'CONFIRMED',
  }));
}

export async function markOrderReady(id: string): Promise<void> {
  await requireAdmin();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
    throw new Error(`Impossible de marquer "prête" depuis ${order.status}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: 'READY' },
  });

  await prisma.$accelerate.invalidate({ tags: ['orders'] });
  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/commandes');
}

export async function cancelOrderFromKitchen(id: string): Promise<void> {
  await requireAdmin();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
    throw new Error(`Impossible d'annuler depuis ${order.status}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  await prisma.$accelerate.invalidate({ tags: ['orders'] });
  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/commandes');
}
