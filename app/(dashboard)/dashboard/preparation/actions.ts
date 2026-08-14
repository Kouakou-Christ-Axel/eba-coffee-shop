'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireKitchen } from '@/lib/auth-helpers';
import {
  fetchPreparationQueue,
  type PreparationOrder,
} from '@/lib/preparation-queue';
import { canRequestDriver } from '@/lib/order-permissions';
import {
  setOrderStatus,
  getOrderShortage,
  StockShortageError,
} from '@/lib/order-mutations';
import type { ShortageLine } from '@/lib/orders/shortage';
import type { UserRole } from '@/generated/prisma/client';

export async function getPreparationQueue(): Promise<PreparationOrder[]> {
  await requireKitchen();
  return fetchPreparationQueue();
}

/**
 * Lance une commande programmée en cuisine (`NEW → PREPARING`), ce qui réserve
 * son stock. C'est LE geste du jour J : une commande différée n'entre jamais en
 * cuisine toute seule, précisément pour qu'un éventuel échec de stock se
 * produise devant quelqu'un.
 *
 * En cas de pénurie, on ne renvoie pas le cuisinier corriger le stock dans le
 * menu : la réponse porte la liste CHIFFRÉE des manques, l'écran demande « vous
 * les avez produits ? », et un second appel avec `coverShortage` enregistre la
 * production puis lance (effet net nul sur le stock).
 *
 * `canTransition('NEW', 'PREPARING', KITCHEN)` passe déjà — cf.
 * lib/order-permissions.ts.
 */
export async function startPreparation(
  id: string,
  opts?: { coverShortage?: boolean }
): Promise<{ error: string; shortage?: ShortageLine[] } | undefined> {
  const session = await requireKitchen();

  try {
    await setOrderStatus(id, 'PREPARING', session.user.role as UserRole, {
      coverShortage: opts?.coverShortage,
    });
  } catch (err) {
    // Jamais un `console.error` muet : le cuisinier doit voir POURQUOI son
    // geste n'a pas abouti.
    const error = err instanceof Error ? err.message : 'Erreur inattendue';
    if (err instanceof StockShortageError) {
      return { error, shortage: await getOrderShortage(id) };
    }
    return { error };
  }

  revalidatePath('/dashboard/preparation');
  revalidatePath('/dashboard/caisse');
  revalidatePath('/dashboard/commandes');
  // L'entrée en cuisine a décompté du stock : la carte publique doit suivre.
  revalidatePath('/api/menu');
  revalidatePath('/carte');
  revalidatePath('/');
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
 * Marquer une commande prête comme récupérée par le client (READY →
 * COMPLETED), même principe qu'en caisse. Délègue à `setOrderStatus` comme
 * `markOrderReady`, pour les mêmes raisons (notifications/push).
 */
export async function markOrderRetrieved(id: string): Promise<void> {
  const session = await requireKitchen();
  await setOrderStatus(id, 'COMPLETED', session.user.role as UserRole);

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
