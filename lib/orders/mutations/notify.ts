// Mutations de commandes — notify.

import type { CartItem } from '@/lib/cart-store';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import { getPickupCode } from '@/lib/orders/format';
import { formatPickup } from '@/lib/orders/scheduling';

/**
 * Notifications push (best-effort) : une notification manquée ne doit jamais
 * faire échouer la mutation qui l'a déclenchée.
 */
export function notifyPush(
  roles: (typeof ROLE_GROUPS)[keyof typeof ROLE_GROUPS],
  payload: Parameters<typeof sendPushToRoles>[1]
): void {
  sendPushToRoles(roles, payload).catch((err) => {
    console.error('[order-mutations] notification push échouée :', err);
  });
}

/**
 * Push « la cuisine a du travail ». Jusqu'ici SEULE la caisse recevait des
 * notifications : la cuisine n'avait que le carillon de sa page, donc écran
 * verrouillé ou onglet en arrière-plan = commande ratée.
 *
 * Cible `KITCHEN_STAFF` (= KITCHEN_PLUS sans CASHIER, cf. lib/auth-helpers.ts)
 * pour ne pas re-notifier le caissier, qui a déjà reçu « nouvelle commande » et
 * qui est généralement celui qui déclenche l'envoi.
 *
 * `tag` par commande : une ré-entrée en cuisine après un undo REMPLACE la
 * notification précédente sur l'appareil au lieu de s'empiler.
 */
export function notifyKitchen(order: {
  id: string;
  dailyNumber: number;
  reference: string;
  items: CartItem[];
}): void {
  // Nombre d'articles réellement à produire (somme des quantités), pas le
  // nombre de lignes du panier : c'est la charge de travail qui parle à la
  // cuisine.
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  notifyPush(ROLE_GROUPS.KITCHEN_STAFF, {
    title: 'Nouvelle commande en cuisine',
    body:
      `#${String(order.dailyNumber).padStart(3, '0')}` +
      ` · ${getPickupCode(order.reference)}` +
      ` · ${itemCount} article${itemCount > 1 ? 's' : ''}`,
    url: '/dashboard/preparation',
    tag: `order-kitchen-${order.id}`,
  });
}

/**
 * Notifications d'une commande de caisse fraîchement créée (jamais pour une
 * commande antidatée : ce n'est pas un événement en direct, juste une saisie
 * de rattrapage — l'appelant filtre).
 */
export function notifyOrderCreated(
  created: {
    id: string;
    dailyNumber: number;
    reference: string;
    total: number;
    customerName: string | null;
    pickupTime: Date | null;
    status: string;
    items: unknown;
  },
  now: Date
): void {
  // Le créneau figure dans le corps : sans lui, une commande pour samedi
  // et un walk-in se ressemblent trait pour trait dans la notification,
  // et la caisse court après une commande qui n'est pas pour maintenant.
  const pickupLabel = created.pickupTime
    ? ` · ${formatPickup(created.pickupTime, now)}`
    : '';
  notifyPush(ROLE_GROUPS.DASHBOARD, {
    title: 'Nouvelle commande',
    body: `#${created.dailyNumber} · ${created.total} FCFA${created.customerName ? ` · ${created.customerName}` : ''}${pickupLabel}`,
    url: '/dashboard/caisse',
    tag: `order-${created.id}`,
  });

  // Ardoise : la commande est née en cuisine, il faut aussi réveiller la
  // cuisine — le push « nouvelle commande » ci-dessus va à la caisse et
  // ne suffit pas (mêmes destinataires que `sendOrderToKitchen`).
  if (created.status === 'PREPARING') {
    notifyKitchen({
      id: created.id,
      dailyNumber: created.dailyNumber,
      reference: created.reference,
      items: created.items as CartItem[],
    });
  }
}
