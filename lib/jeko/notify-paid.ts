// lib/jeko/notify-paid.ts
//
// Annonce d'une commande en ligne AU PAIEMENT. Tant qu'elle attend, elle est
// invisible du staff (lib/orders/visibility.ts) : `createOrder` ne notifie rien,
// c'est ici que partent le push du dashboard et le courriel au propriétaire.
// Les deux sont best-effort et indépendants : l'échec de l'un n'empêche jamais
// l'autre, et rien ne doit faire échouer le règlement qui vient d'avoir lieu.

import prisma from '@/lib/prisma';
import { sendNewOrderEmail } from '@/lib/email';
import { ROLE_GROUPS } from '@/lib/auth-helpers';
import { sendPushToRoles } from '@/lib/push-notify';
import { getPickupCode } from '@/lib/orders/format';
import type { CartItem } from '@/lib/cart-store';

export async function announcePaidOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  await sendPushToRoles(ROLE_GROUPS.DASHBOARD, {
    title: 'Nouvelle commande en ligne',
    body:
      `#${String(order.dailyNumber).padStart(3, '0')} · ${getPickupCode(order.reference)}` +
      ` · ${order.total} FCFA · payée` +
      `${order.customerName ? ` · ${order.customerName}` : ''}` +
      `${order.orderType === 'DELIVERY' ? ' · livreur client' : ''}`,
    url: '/dashboard/caisse',
    tag: `order-${order.id}`,
  }).catch((err) => {
    console.error('[jeko] notification push échouée :', err);
  });

  await sendNewOrderEmail({
    id: order.id,
    reference: order.reference,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    pickupTime: order.pickupTime,
    items: order.items as unknown as CartItem[],
    total: order.total,
  }).catch((err) => {
    console.error('[jeko] courriel propriétaire échoué :', err);
  });
}
