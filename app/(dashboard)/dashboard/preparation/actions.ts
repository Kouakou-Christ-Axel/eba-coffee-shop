'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  fetchPreparationQueue,
  type PreparationOrder,
} from '@/lib/preparation-queue';
import { canRequestDriver } from '@/lib/order-permissions';
import { setOrderStatus } from '@/lib/order-mutations';
import type { UserRole } from '@/generated/prisma/client';

export async function getPreparationQueue(): Promise<PreparationOrder[]> {
  await requireKitchen();
  return fetchPreparationQueue();
}

/**
 * Délègue à `setOrderStatus` plutôt que d'écrire directement : un `updateMany`
 * brut sautait les notifications (push « Commande prête » vers la caisse ET
 * `notifyOrderCustomer(id, 'READY')` vers le client), qui ne partaient donc
 * jamais quand c'était la CUISINE qui validait — seul le carillon de la page
 * fonctionnait. `canTransition('PREPARING', 'READY', KITCHEN)` passe, et
 * `requireKitchen()` nous donne déjà le rôle.
 */
export async function markOrderReady(id: string): Promise<void> {
  const session = await requireKitchen();
  await setOrderStatus(id, 'READY', session.user.role as UserRole);

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
  revalidatePath('/dashboard/commandes');
}

/**
 * DÉLIBÉRÉMENT laissée en `updateMany` brut, contrairement à `markOrderReady` :
 * `KITCHEN` n'appartient pas à `CASHIER_PLUS`, or PREPARING → CANCELLED est
 * réservé à `CASHIER_PLUS` (lib/order-permissions.ts). Passer par
 * `setOrderStatus` ferait donc rejeter toutes les annulations cuisine.
 */
export async function cancelOrderFromKitchen(id: string): Promise<void> {
  await requireKitchen();

  const result = await prisma.order.updateMany({
    where: { id, status: 'PREPARING' },
    data: { status: 'CANCELLED' },
  });

  if (result.count === 0) {
    throw new Error('Commande introuvable ou déjà sortie de préparation');
  }

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
