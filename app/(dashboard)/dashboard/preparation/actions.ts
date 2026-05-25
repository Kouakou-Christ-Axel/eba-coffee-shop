'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  fetchPreparationQueue,
  type PreparationOrder,
} from '@/lib/preparation-queue';
import { canRequestDriver } from '@/lib/order-permissions';
import type { UserRole } from '@/generated/prisma/client';

export async function getPreparationQueue(): Promise<PreparationOrder[]> {
  await requireKitchen();
  return fetchPreparationQueue();
}

export async function startPreparation(id: string): Promise<void> {
  await requireKitchen();

  const result = await prisma.order.updateMany({
    where: { id, status: 'NEW' },
    data: { status: 'PREPARING' },
  });

  if (result.count === 0) {
    throw new Error(
      'Impossible de démarrer : commande introuvable ou déjà en préparation'
    );
  }

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
  revalidatePath('/dashboard/commandes');
}

export async function markOrderReady(id: string): Promise<void> {
  await requireKitchen();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status !== 'NEW' && order.status !== 'PREPARING') {
    throw new Error(`Impossible de marquer "prête" depuis ${order.status}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: 'READY' },
  });

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
  revalidatePath('/dashboard/commandes');
}

export async function cancelOrderFromKitchen(id: string): Promise<void> {
  await requireKitchen();

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new Error('Commande introuvable');
  if (order.status !== 'NEW' && order.status !== 'PREPARING') {
    throw new Error(`Impossible d'annuler depuis ${order.status}`);
  }

  await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
  revalidatePath('/dashboard/commandes');
}

export async function requestDriver(id: string): Promise<void> {
  const session = await requireKitchen();
  const role = session.user.role as UserRole;
  if (!canRequestDriver(role)) {
    throw new Error('Non autorisé');
  }

  const result = await prisma.order.updateMany({
    where: { id, driverRequested: false },
    data: { driverRequested: true, driverRequestedAt: new Date() },
  });

  if (result.count === 0) {
    throw new Error('Demande déjà envoyée ou commande introuvable');
  }

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
}
