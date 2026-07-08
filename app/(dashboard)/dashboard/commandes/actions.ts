'use server';

import { revalidatePath } from 'next/cache';
import { requireCashier, requireAdmin } from '@/lib/auth-helpers';
import {
  setOrderStatus,
  setOrderPayment,
  payAndComplete,
  updateOrderItems,
  setOrderCustomer,
  updateOrderDetails,
} from '@/lib/order-mutations';
import type {
  SetOrderCustomerInput,
  UpdateOrderDetailsInput,
} from '@/lib/schemas/order';
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

// Un paiement réussi peut avoir décrémenté du stock (produit/option) : la
// carte publique (ISR) doit se rafraîchir. Best-effort, jamais bloquant.
function revalidatePublicMenu(): void {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
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
  revalidatePublicMenu();
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
  revalidatePublicMenu();
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
 * Édite les métadonnées d'une commande (moyen de paiement, type de commande,
 * créneau de retrait, note). RÉSERVÉ À L'ADMIN : `requireAdmin` rejette CASHIER
 * et KITCHEN même s'ils ont accès au reste du dashboard.
 */
export async function updateOrderDetailsAction(
  id: string,
  input: UpdateOrderDetailsInput
): Promise<void> {
  await requireAdmin();

  await updateOrderDetails(id, input);
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
