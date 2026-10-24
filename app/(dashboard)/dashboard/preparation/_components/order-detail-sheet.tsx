'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  ignoreNestedModalInteraction,
} from '@/components/ui/sheet';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { MenuCategory } from '@/config/menu';
import { OrderDetailActions } from './order-detail/order-detail-actions';
import { OrderDetailContent } from './order-detail/order-detail-content';
import { OrderDetailHeader } from './order-detail/order-detail-header';
import { MatesBanner } from './group/mates-banner';
import { OrderEditModal } from './order-detail/order-edit-modal';
import type { ContactInfo, OrderDetailCallbacks } from './order-detail/types';

type Props = OrderDetailCallbacks & {
  order: PreparationOrder | null;
  menu: MenuCategory[];
  now: Date;
  pending: boolean;
  contactSettings: ContactInfo;
  onClose: () => void;
  /** Autres commandes du même client (groupe) + clé du groupe ; vide = commande seule. */
  mates?: PreparationOrder[];
  groupKey?: string;
};

/**
 * Bottom sheet de détail d'UNE commande, pensé pour être lu de loin en cuisine
 * (numéro et articles très grands). Ouvert au toucher d'une carte / d'une ligne
 * de liste. Regroupe aussi les actions (Prête / Annuler / Livreur) en gros
 * boutons tactiles. Pour une commande déjà prête (READY), remplace « Prête »
 * par le lien de suivi et le bouton « Marquer récupérée ».
 */
export function OrderDetailSheet({
  order,
  menu,
  now,
  pending,
  contactSettings,
  onClose,
  onReady,
  onCancel,
  onRequestDriver,
  onRetrieve,
  payAction,
  customerAction,
  mates,
  groupKey,
}: Props) {
  const open = order !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="h-[92vh] max-h-[92vh] gap-0 overflow-y-auto rounded-t-3xl p-0"
        onPointerDownOutside={ignoreNestedModalInteraction}
        onFocusOutside={ignoreNestedModalInteraction}
      >
        {order && (
          <OrderDetailBody
            order={order}
            menu={menu}
            now={now}
            pending={pending}
            contactSettings={contactSettings}
            onReady={onReady}
            onCancel={onCancel}
            onRequestDriver={onRequestDriver}
            onRetrieve={onRetrieve}
            payAction={payAction}
            customerAction={customerAction}
            mates={mates}
            groupKey={groupKey}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrderDetailBody({
  order,
  menu,
  now,
  pending,
  contactSettings,
  mates = [],
  groupKey,
  ...callbacks
}: OrderDetailCallbacks & {
  mates?: PreparationOrder[];
  groupKey?: string;
  order: PreparationOrder;
  menu: MenuCategory[];
  now: Date;
  pending: boolean;
  contactSettings: ContactInfo;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <OrderDetailHeader order={order} now={now} />
      {groupKey && <MatesBanner mates={mates} groupKey={groupKey} />}
      <OrderDetailContent order={order} />
      <OrderDetailActions
        order={order}
        pending={pending}
        contactSettings={contactSettings}
        onEdit={() => setIsEditOpen(true)}
        {...callbacks}
      />
      <OrderEditModal
        order={order}
        menu={menu}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  );
}
