'use client';

import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { orderRef } from '@/lib/orders/customer-groups';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { ContactSettings } from '@/lib/contact-settings';
import {
  elapsedMinutes,
  elapsedTone,
  KITCHEN_ALERT_MIN,
  KITCHEN_WARN_MIN,
} from './elapsed';
import { CardActions } from './prep-card/card-actions';
import { CardBody } from './prep-card/card-body';
import { DriverRequest } from './prep-card/driver-request';
import { groupColor } from './group/group-color';

export { ORDER_TYPE_META, SOURCE_META } from './prep-card/meta';

type Props = {
  order: PreparationOrder;
  now: Date;
  pending: boolean;
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
  onExpand: (id: string) => void;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
  onRetrieve: (id: string) => void;
  /** Autres commandes du même client (groupe) ; vide = commande seule. */
  mates?: PreparationOrder[];
  groupKey?: string;
};

export function PrepOrderCard({
  order,
  now,
  pending,
  contactSettings,
  onExpand,
  onReady,
  onCancel,
  onRequestDriver,
  onRetrieve,
  mates = [],
  groupKey,
}: Props) {
  const isDelivery = order.orderType === 'DELIVERY';
  // Chrono « en cuisine depuis X » : repli createdAt pour les commandes
  // antérieures à la colonne preparingStartedAt.
  const since = order.preparingStartedAt ?? order.createdAt;
  const mins = elapsedMinutes(since, now);
  const tone = elapsedTone(mins, KITCHEN_WARN_MIN, KITCHEN_ALERT_MIN);

  return (
    <article
      className={cn(
        'flex flex-col rounded-2xl border-2 bg-card shadow-sm',
        tone === 'alert'
          ? 'border-red-300 dark:border-red-800'
          : tone === 'warn'
            ? 'border-amber-300 dark:border-amber-800'
            : 'border-border'
      )}
    >
      {mates.length > 0 && groupKey && (
        <p
          className={cn(
            'flex items-center gap-1.5 rounded-t-[14px] px-3 py-1 text-xs font-bold',
            groupColor(groupKey).chip
          )}
        >
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Avec {mates.map(orderRef).join(' · ')}
        </p>
      )}

      <CardBody order={order} mins={mins} tone={tone} onExpand={onExpand} />

      {isDelivery && (
        <DriverRequest
          order={order}
          pending={pending}
          contactSettings={contactSettings}
          onRequestDriver={onRequestDriver}
        />
      )}

      <CardActions
        orderId={order.id}
        pending={pending}
        onReady={onReady}
        onCancel={onCancel}
        onRetrieve={onRetrieve}
      />
    </article>
  );
}
