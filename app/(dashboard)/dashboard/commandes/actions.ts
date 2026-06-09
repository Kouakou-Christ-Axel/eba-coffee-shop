'use server';

import { revalidatePath } from 'next/cache';
import { requireCashier } from '@/lib/auth-helpers';
import {
  setOrderStatus,
  setOrderPayment,
  updateOrderItems,
} from '@/lib/order-mutations';
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

export async function updateOrderItemsAction(
  id: string,
  items: CartItem[]
): Promise<void> {
  await requireCashier();

  await updateOrderItems(id, items);
  revalidateOrder(id);
}
