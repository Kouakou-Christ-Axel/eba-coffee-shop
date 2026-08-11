'use client';

import { Inbox } from 'lucide-react';
import { OrderCard } from '../order-card';
import { OrderCardActions } from '../order-card-actions';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { MenuCategory } from '@/config/menu';
import type { ContactSettings } from '@/lib/contact-settings';
import { getUrgencyLevel, type TabKey } from '../urgency';

type Props = {
  orders: CashierOrder[];
  tab: TabKey;
  menu: MenuCategory[];
  contactSettings: Pick<
    ContactSettings,
    | 'yangoLandmark'
    | 'mapsDirectionsUrl'
    | 'wavePaymentNumber'
    | 'orangeMoneyPaymentNumber'
  >;
  now: Date;
};

export function CaisseOrderList({
  orders,
  tab,
  menu,
  contactSettings,
  now,
}: Props) {
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
    /* Deux colonnes sur grand écran seulement : une carte porte jusqu'à 8
       boutons pleine largeur, donc la file devient très haute. En dessous de
       `xl`, la barre latérale du dashboard laisse trop peu de largeur pour
       deux colonnes lisibles. */
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
      {orders.map((o) => (
        <OrderCard
          key={o.id}
          order={o}
          urgency={getUrgencyLevel(o, tab, now)}
          now={now}
          actions={
            <OrderCardActions
              order={o}
              menu={menu}
              contactSettings={contactSettings}
            />
          }
        />
      ))}
    </div>
  );
}
