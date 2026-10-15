'use client';

import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  ignoreNestedModalInteraction,
} from '@/components/ui/sheet';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { OrderDetailActions } from './order-detail/order-detail-actions';
import { OrderDetailContent } from './order-detail/order-detail-content';
import { OrderDetailHeader } from './order-detail/order-detail-header';
import { MatesBanner } from './group/mates-banner';
import type { ContactInfo, OrderDetailCallbacks } from './order-detail/types';

type Props = OrderDetailCallbacks & {
  order: PreparationOrder | null;
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
        className="h-[94dvh] max-h-[94dvh] gap-0 rounded-t-3xl p-0"
        onPointerDownOutside={ignoreNestedModalInteraction}
        onFocusOutside={ignoreNestedModalInteraction}
      >
        {order && (
          <OrderDetailBody
            order={order}
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
  now: Date;
  pending: boolean;
  contactSettings: ContactInfo;
}) {
  const router = useRouter();

  return (
    <>
      <OrderDetailHeader order={order} now={now} />
      {groupKey && <MatesBanner mates={mates} groupKey={groupKey} />}
      <OrderDetailContent order={order} />
      <OrderDetailActions
        order={order}
        pending={pending}
        contactSettings={contactSettings}
        onEdit={() =>
          router.push(`/dashboard/preparation/${order.id}/modifier`)
        }
        {...callbacks}
      />
    </>
  );
}
