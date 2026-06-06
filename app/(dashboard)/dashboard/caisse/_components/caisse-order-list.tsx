'use client';

import { Inbox } from 'lucide-react';
import { OrderCard } from '../order-card';
import { OrderCardActions } from '../order-card-actions';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import { getUrgencyLevel, type TabKey } from '../urgency';

type Props = {
  orders: CashierOrder[];
  tab: TabKey;
  menu: MenuCategory[];
  now: Date;
};

export function CaisseOrderList({ orders, tab, menu, now }: Props) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-8 text-center text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm font-medium">
          {tab === 'to-pay' && 'Aucune commande à encaisser'}
          {tab === 'in-progress' && 'Aucune commande en cours'}
          {tab === 'ready' && 'Aucune commande prête'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          urgency={getUrgencyLevel(o, tab, now)}
          now={now}
          actions={<OrderCardActions order={o} menu={menu} />}
        />
      ))}
    </div>
  );
}
