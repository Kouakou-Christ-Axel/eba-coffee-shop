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
  OrderPaymentLineInput,
} from '@/lib/schemas/order';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus, UserRole } from '@/generated/prisma/client';

/** Revalide la page de détail et la liste après une mutation de commande. */
function revalidateOrder(id: string): void {
  revalidatePath(`/dashboard/commandes/${id}`);
  revalidatePath('/dashboard/commandes');
  // L'ardoise (/dashboard/ardoise) liste les impayés tous jours confondus :
  // encaisser, dépayer ou annuler une commande la fait entrer ou sortir de la
  // liste. Elle appelle d'ailleurs `markOrderPaidAction` directement.
  revalidatePath('/dashboard/ardoise');
}

// Next.js redacte en production le message de toute erreur qui *traverse*
// une Server Action (générique « An error occurred in the Server
// Components render… », quel que soit le type d'erreur) : un throw ne suffit
// pas à faire remonter au caissier la vraie raison d'un refus de paiement
// (ex. `StockShortageError` — « Stock insuffisant pour « Produit — Option » »).
// Cf. app/(dashboard)/dashboard/menu/actions.ts pour le même motif appliqué
// à la sauvegarde d'un produit.
//
// Toutes les actions de ce fichier renvoient donc `{ error }` plutôt que de
// laisser l'erreur traverser : un 403 (rôle), un 409 (« État déjà modifié par
// un autre caissier ») ou une rupture de stock n'affichaient RIEN au staff, et
// le bouton semblait simplement inerte.
function formatMutationError(err: unknown): string {
  return err instanceof Error ? err.message : 'Erreur inattendue';
}

// Un paiement réussi peut avoir décrémenté du stock (produit/option) : la
// carte publique (ISR) doit se rafraîchir. Best-effort, jamais bloquant.
function revalidatePublicMenu(): void {
  revalidatePath('/api/menu');
  revalidatePath('/carte');
  // L'accueil aussi : sa vitrine est commandable et filtre sur le stock.
  revalidatePath('/');
}

export async function updateOrderStatus(
  id: string,
  newStatus: OrderStatus
): Promise<{ error: string } | undefined> {
  const session = await requireCashier();
  const role = session.user.role as UserRole;

  try {
    await setOrderStatus(id, newStatus, role);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
}

/**
 * Encaisse une commande (marque payée) depuis la section Commandes. `payments`
 * (1..N lignes `{mode, amount}`) doit sommer exactement au total de la
 * commande — paiement fractionné supporté.
 */
export async function markOrderPaidAction(
  id: string,
  payments: OrderPaymentLineInput[]
): Promise<{ error: string } | undefined> {
  const session = await requireCashier();

  try {
    await setOrderPayment(id, true, payments, session.user.id);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
  revalidatePublicMenu();
}

/**
 * Action express : marque la commande payée (si besoin) ET récupérée en un
 * clic. `payments` est ignoré si la commande est déjà payée.
 */
export async function payAndCompleteAction(
  id: string,
  payments: OrderPaymentLineInput[] | undefined
): Promise<{ error: string } | undefined> {
  const session = await requireCashier();
  const role = session.user.role as UserRole;

  try {
    await payAndComplete(id, payments, role, session.user.id);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
  revalidatePublicMenu();
}

export async function updateOrderItemsAction(
  id: string,
  items: CartItem[]
): Promise<{ error: string } | undefined> {
  await requireCashier();

  try {
    await updateOrderItems(id, items);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
  // Une hausse de quantité sur une commande déjà en cuisine peut avoir
  // décrémenté du stock (cf. `decrementStockDelta` dans `updateOrderItems`).
  revalidatePublicMenu();
}

/**
 * Édite les métadonnées d'une commande (moyen de paiement, type de commande,
 * créneau de retrait, note). RÉSERVÉ À L'ADMIN : `requireAdmin` rejette CASHIER
 * et KITCHEN même s'ils ont accès au reste du dashboard.
 */
export async function updateOrderDetailsAction(
  id: string,
  input: UpdateOrderDetailsInput
): Promise<{ error: string } | undefined> {
  await requireAdmin();

  try {
    await updateOrderDetails(id, input);
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
}

/**
 * Associe (ou détache) un client à une commande depuis la page de détail.
 * Revalide aussi la fiche client concernée (ses stats / commandes changent).
 */
export async function setOrderCustomerAction(
  id: string,
  input: SetOrderCustomerInput
): Promise<{ error: string } | undefined> {
  const session = await requireCashier();

  let customerId: string | null;
  try {
    ({ customerId } = await setOrderCustomer(id, input, session.user.id));
  } catch (err) {
    return { error: formatMutationError(err) };
  }
  revalidateOrder(id);
  if (customerId) {
    revalidatePath(`/dashboard/clients/${customerId}`);
    revalidatePath('/dashboard/clients');
  }
}
