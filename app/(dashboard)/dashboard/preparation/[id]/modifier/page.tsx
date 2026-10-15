import { notFound } from 'next/navigation';
import { requireKitchen } from '@/lib/auth-helpers';
import { getMenu } from '@/lib/menu';
import { getOrder } from '@/lib/orders';
import type { CartItem } from '@/lib/cart-store';
import { EditOrderView } from './edit-order-view';

export const dynamic = 'force-dynamic';

// Édition des articles d'une commande depuis la cuisine. Une PAGE et non une
// modale : une modale HeroUI ouverte dans le Sheet Radix du détail se fermait
// au premier clic (conflit de pointer-events / focus entre les deux
// bibliothèques). Même éditeur que `commandes/[id]`.
export default async function EditPreparationOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [, order, menu] = await Promise.all([
    requireKitchen(),
    getOrder(id),
    getMenu(),
  ]);

  if (!order) notFound();

  return (
    <EditOrderView
      orderId={order.id}
      dailyNumber={order.dailyNumber}
      status={order.status}
      initialItems={order.items as CartItem[]}
      menu={menu}
      stockReserved={order.stockReservedAt !== null}
    />
  );
}
