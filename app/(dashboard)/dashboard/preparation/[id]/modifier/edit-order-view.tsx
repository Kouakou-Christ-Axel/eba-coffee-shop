'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { MenuCategory } from '@/config/menu';
import type { CartItem } from '@/lib/cart-store';
import type { OrderStatus } from '@/generated/prisma/client';
import { OrderItemsEditor } from '../../../_components/order-items-editor';

const BACK_HREF = '/dashboard/preparation';

export function EditOrderView({
  orderId,
  dailyNumber,
  status,
  initialItems,
  menu,
  stockReserved,
}: {
  orderId: string;
  dailyNumber: number;
  status: OrderStatus;
  initialItems: CartItem[];
  menu: MenuCategory[];
  stockReserved: boolean;
}) {
  const router = useRouter();
  // Même règle que `commandes/[id]` : plus modifiable une fois récupérée ou annulée.
  const locked = status === 'COMPLETED' || status === 'CANCELLED';

  function leave() {
    router.push(BACK_HREF);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Link
          href={BACK_HREF}
          aria-label="Retour à la cuisine"
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-xl font-bold">
          Commande #{String(dailyNumber).padStart(3, '0')}
        </h1>
      </div>

      {locked ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Cette commande est {status === 'CANCELLED' ? 'annulée' : 'récupérée'}{' '}
          : ses articles ne sont plus modifiables.
        </p>
      ) : (
        <OrderItemsEditor
          orderId={orderId}
          initialItems={initialItems}
          menu={menu}
          stockReserved={stockReserved}
          onClose={leave}
        />
      )}
    </div>
  );
}
