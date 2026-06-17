'use server';

import { revalidatePath } from 'next/cache';
import { requireCashier } from '@/lib/auth-helpers';
import {
  setOrderStatus,
  setOrderPayment,
  payAndComplete,
  updateOrderItems,
  setOrderCustomer,
} from '@/lib/order-mutations';
import type { SetOrderCustomerInput } from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import type {
  OrderStatus,
  PaymentMode,
  UserRole,
} from '@/generated/prisma/client';

/** Revalide la page de détail et la liste après une mutation de commande. */
function revalidateOrder(id: string): void {
  revalidatePath(`/dashboard/commandes/${id}`);
  revalidatePath('/dashboard/commandes');
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<void> {
  const session = await requireCashier();
  const role = session.user.role as UserRole;

  await setOrderStatus(id, newStatus, role);
  revalidateOrder(id);
}

/** Encaisse une commande (marque payée) depuis la section Commandes. */
export async function markOrderPaidAction(
  id: string,
  paymentMode: PaymentMode
): Promise<void> {
  await requireCashier();

  await setOrderPayment(id, true, paymentMode);
  revalidateOrder(id);
}

/**
 * Action express : marque la commande payée (si besoin) ET récupérée en un clic.
 */
export async function payAndCompleteAction(
  id: string,
  paymentMode: PaymentMode
): Promise<void> {
  const session = await requireCashier();
  const role = session.user.role as UserRole;

  await payAndComplete(id, paymentMode, role);
  revalidateOrder(id);
}

export async function updateOrderItemsAction(
  id: string,
  items: CartItem[]
): Promise<void> {
  await requireCashier();

  await updateOrderItems(id, items);
  revalidateOrder(id);
}

/**
 * Associe (ou détache) un client à une commande depuis la page de détail.
 * Revalide aussi la fiche client concernée (ses stats / commandes changent).
 */
export async function setOrderCustomerAction(
  id: string,
  input: SetOrderCustomerInput
): Promise<void> {
  const session = await requireCashier();

  const { customerId } = await setOrderCustomer(id, input, session.user.id);
  revalidateOrder(id);
  if (customerId) {
    revalidatePath(`/dashboard/clients/${customerId}`);
    revalidatePath('/dashboard/clients');
  }
}
