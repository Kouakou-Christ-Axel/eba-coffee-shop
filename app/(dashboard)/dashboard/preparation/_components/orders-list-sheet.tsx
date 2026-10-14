'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  ignoreNestedModalInteraction,
} from '@/components/ui/sheet';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { buildQueueEntries } from '@/lib/orders/customer-groups';
import type { KitchenGroup } from '@/lib/orders/kitchen-group';
import { GroupFrame } from './group/group-frame';
import { orderRef } from '@/lib/orders/customer-groups';
import { summarizeKitchenGroup } from '@/lib/orders/kitchen-group';
import { OrdersListRow } from './orders-list/orders-list-row';
import type { OrdersListVariant, RowCallbacks } from './orders-list/types';
import { VARIANT_META } from './orders-list/variant-meta';

export type { OrdersListVariant } from './orders-list/types';

type Props = Omit<RowCallbacks, 'onExpand'> & {
  variant: OrdersListVariant;
  orders: PreparationOrder[];
  now: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpand: (id: string) => void;
  pendingIds: Set<string>;
  /** Clients à plusieurs commandes (variante `ready`) : leurs lignes se suivent sous un en-tête commun. */
  groups?: Map<string, KitchenGroup>;
  onRetrieveMany?: (ids: string[]) => void;
};

/**
 * Bottom sheet listant les commandes qui ne sont PAS dans le travail courant :
 *   - `scheduled` : programmées à retrait lointain (déchargées de la grille).
 *   - `ready`     : prêtes en attente de récupération (emballage + codes).
 *   - `topay`     : ardoise — non payées, en préparation ou prêtes.
 * Chaque ligne est tactile → ouvre le bottom sheet de détail lisible.
 */
export function OrdersListSheet({
  variant,
  orders,
  now,
  open,
  onOpenChange,
  onExpand,
  pendingIds,
  onRetrieve,
  onStartPreparation,
  onCancel,
  action,
  groups,
  onRetrieveMany,
}: Props) {
  const meta = VARIANT_META[variant];
  const Icon = meta.Icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[60vh] max-h-[85vh] gap-0 rounded-t-3xl p-0"
        onPointerDownOutside={ignoreNestedModalInteraction}
        onFocusOutside={ignoreNestedModalInteraction}
      >
        <SheetHeader className="border-b p-5 pr-14">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Icon className="h-5 w-5" />
            {meta.title} ({orders.length})
          </SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {variant === 'scheduled'
                ? 'Aucune commande programmée.'
                : variant === 'topay'
                  ? 'Aucune commande à encaisser pour l’instant.'
                  : 'Aucune commande prête pour l’instant.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {(variant === 'ready' && groups
                ? buildQueueEntries(orders, groups)
                : orders.map((order) => ({ kind: 'single' as const, order }))
              ).map((entry) => {
                const row = (order: PreparationOrder) => (
                  <OrdersListRow
                    key={order.id}
                    variant={variant}
                    order={order}
                    now={now}
                    onExpand={onExpand}
                    pending={pendingIds.has(order.id)}
                    onRetrieve={onRetrieve}
                    onStartPreparation={onStartPreparation}
                    onCancel={onCancel}
                    action={action}
                  />
                );
                if (entry.kind === 'single') return row(entry.order);
                const s = summarizeKitchenGroup(entry.group);
                const readyIds = s.ready.map((o) => o.id);
                return (
                  <GroupFrame
                    key={entry.group.key}
                    group={entry.group}
                    label="À remettre ensemble"
                    trailing={`${s.ready.length}/${s.total} prêtes`}
                    notice={
                      s.cooking.length > 0
                        ? `Attendre ${s.cooking.map(orderRef).join(' · ')} avant de remettre`
                        : undefined
                    }
                    action={
                      readyIds.length > 0
                        ? {
                            label: `Tout marquer récupéré (${readyIds.length})`,
                            disabled: entry.inTab.some((o) =>
                              pendingIds.has(o.id)
                            ),
                            onClick: () => onRetrieveMany?.(readyIds),
                          }
                        : undefined
                    }
                  >
                    {entry.inTab.map(row)}
                  </GroupFrame>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
