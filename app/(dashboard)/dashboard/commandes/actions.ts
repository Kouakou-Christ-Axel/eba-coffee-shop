'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireCashier } from '@/lib/auth-helpers';
import { setOrderStatus, setOrderPayment } from '@/lib/order-mutations';
import { computeItemsTotal, getMaxItemDiscount } from '@/lib/orders/totals';
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
