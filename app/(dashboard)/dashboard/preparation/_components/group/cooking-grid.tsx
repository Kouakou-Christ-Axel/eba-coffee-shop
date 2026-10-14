'use client';

import { buildQueueEntries } from '@/lib/orders/customer-groups';
import { groupMates, type KitchenGroup } from '@/lib/orders/kitchen-group';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { ContactSettings } from '@/lib/contact-settings';
import { PrepOrderCard } from '../prep-order-card';
import { KitchenGroupCluster } from './kitchen-group-cluster';

type CardCallbacks = {
  onExpand: (id: string) => void;
  onReady: (id: string) => void;
  onCancel: (id: string) => void;
  onRequestDriver: (id: string) => void;
  onRetrieve: (id: string) => void;
};

type Props = CardCallbacks & {
  cooking: PreparationOrder[];
  groups: Map<string, KitchenGroup>;
  now: Date;
  pendingIds: Set<string>;
  isPending: boolean;
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
  onReadyMany: (ids: string[]) => void;
  onRequestDriverMany: (ids: string[]) => void;
};

/**
 * Grille « À cuisiner maintenant ». Les commandes d'un même client forment un
 * bloc (cf. `KitchenGroupCluster`) à la place de leur première commande ; les
 * autres restent des cartes isolées, dans le même ordre FIFO qu'avant.
 */
export function CookingGrid({
  cooking,
  groups,
  now,
  pendingIds,
  isPending,
  contactSettings,
  onReadyMany,
  onRequestDriverMany,
  ...callbacks
}: Props) {
  const card = (order: PreparationOrder, group?: KitchenGroup) => (
    <PrepOrderCard
      key={order.id}
      order={order}
      now={now}
      pending={pendingIds.has(order.id) || isPending}
      contactSettings={contactSettings}
      mates={groupMates(group, order)}
      groupKey={group?.key}
      {...callbacks}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {buildQueueEntries(cooking, groups).map((entry) =>
        entry.kind === 'group' ? (
          <KitchenGroupCluster
            key={entry.group.key}
            group={entry.group}
            members={entry.inTab}
            onExpand={callbacks.onExpand}
            pending={isPending}
            contactSettings={contactSettings}
            onReadyMany={onReadyMany}
            onRequestDriverMany={onRequestDriverMany}
          >
            {entry.inTab.map((o) => card(o, entry.group))}
          </KitchenGroupCluster>
        ) : (
          card(entry.order)
        )
      )}
    </div>
  );
}
