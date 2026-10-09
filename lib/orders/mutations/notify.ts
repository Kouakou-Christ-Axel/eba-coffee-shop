// Mutations de commandes — notify.

import type { CartItem } from '@/lib/cart-store';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import { getPickupCode } from '@/lib/orders/format';
import { formatPickup } from '@/lib/orders/scheduling';

export function notifyPush(
  roles: (typeof ROLE_GROUPS)[keyof typeof ROLE_GROUPS],
  payload: Parameters<typeof sendPushToRoles>[1]
): void {
  sendPushToRoles(roles, payload).catch((err) => {
    console.error('[order-mutations] notification push échouée :', err);
  });
}

/** Push « la cuisine a du travail ». */
export function notifyKitchen(order: {
  id: string;
  dailyNumber: number;
  reference: string;
  items: CartItem[];
}): void {
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
  const pickupLabel = created.pickupTime
    ? ` · ${formatPickup(created.pickupTime, now)}`
    : '';
  notifyPush(ROLE_GROUPS.DASHBOARD, {
    title: 'Nouvelle commande',
    body: `#${created.dailyNumber} · ${created.total} FCFA${created.customerName ? ` · ${created.customerName}` : ''}${pickupLabel}`,
    url: '/dashboard/caisse',
    tag: `order-${created.id}`,
  });

  if (created.status === 'PREPARING') {
    notifyKitchen({
      id: created.id,
      dailyNumber: created.dailyNumber,
      reference: created.reference,
      items: created.items as CartItem[],
    });
  }
}
