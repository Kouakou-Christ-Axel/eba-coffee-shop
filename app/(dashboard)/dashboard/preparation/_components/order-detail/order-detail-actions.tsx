'use client';

import { Bike, Check, CheckCheck, ChefHat, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import type { PreparationOrder } from '@/lib/preparation-queue';
import {
  buildDriverRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { EncaisserButton } from '../../../_components/encaisser-button';
import { OrderMoreMenu } from './order-more-menu';
import type { ContactInfo, OrderDetailCallbacks } from './types';

export function OrderDetailActions({
  order,
  pending,
  contactSettings,
  onEdit,
  onReady,
  onCancel,
  onRequestDriver,
  onRetrieve,
  payAction,
  customerAction,
}: OrderDetailCallbacks & {
  order: PreparationOrder;
  pending: boolean;
  contactSettings: ContactInfo;
  onEdit: () => void;
}) {
  const isDelivery = order.orderType === 'DELIVERY';
  const isReady = order.status === 'READY';
  // Lien `null` si aucun téléphone n'est renseigné.
  const driverLink = buildWhatsAppLink(
    order.customerPhone,
    buildDriverRequestMessage({
      customerName: order.customerName,
      dailyNumber: order.dailyNumber,
      yangoLandmark: contactSettings.yangoLandmark,
      phone: contactSettings.phone,
    })
  );

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      {isDelivery &&
        (driverLink ? (
          // Ouvre WhatsApp avec le message pré-rempli ET pose le drapeau
          // `driverRequested` (bandeau lu par la caisse) dans le même geste.
          <a
            href={driverLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!order.driverRequested) onRequestDriver(order.id);
            }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border py-2 text-base font-semibold transition-colors',
              order.driverRequested
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
            )}
          >
            <Bike className="h-5 w-5" />
            {order.driverRequested
              ? 'Livreur demandé — relancer sur WhatsApp'
              : 'Demander le livreur'}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDriver(order.id)}
            disabled={pending || order.driverRequested}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl border py-2 text-base font-semibold transition-colors disabled:opacity-60',
              order.driverRequested
                ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
            )}
          >
            <Bike className="h-5 w-5" />
            {order.driverRequested ? 'Livreur demandé' : 'Demander le livreur'}
          </button>
        ))}

      {!order.isPaid && payAction && (
        <EncaisserButton
          orderId={order.id}
          orderRef={order.reference}
          amount={order.total - order.depositPaid}
          action={payAction}
          size="lg"
          className="py-3 text-lg"
        />
      )}

      {isReady ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              disabled={pending}
              aria-label="Annuler"
              className="flex shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              <X className="h-6 w-6" strokeWidth={2.5} />
            </button>
            <OrderMoreMenu
              order={order}
              customerAction={customerAction}
              onEdit={onEdit}
            />
            <TrackingLinkButton orderId={order.id} className="flex-1 py-1" />
          </div>
          <button
            type="button"
            onClick={() => onRetrieve(order.id)}
            disabled={pending}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-xl font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
          >
            {pending ? (
              <ChefHat className="h-7 w-7 animate-pulse" />
            ) : (
              <CheckCheck className="h-7 w-7" strokeWidth={2.5} />
            )}
            Marquer récupérée
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[auto_auto_1fr] gap-3">
            <button
              type="button"
              onClick={() => onCancel(order.id)}
              disabled={pending}
              aria-label="Annuler"
              className="flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 transition-colors hover:bg-red-100 active:bg-red-200 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
            >
              <X className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <OrderMoreMenu
              order={order}
              customerAction={customerAction}
              onEdit={onEdit}
            />
            <button
              type="button"
              onClick={() => onReady(order.id)}
              disabled={pending}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-xl font-bold text-white shadow-sm transition-colors hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
            >
              {pending ? (
                <ChefHat className="h-7 w-7 animate-pulse" />
              ) : (
                <Check className="h-7 w-7" strokeWidth={3} />
              )}
              Prête
            </button>
          </div>
          {/* Récupération anticipée : discrète, le client peut repartir
                avant la fin de la préparation affichée à l'écran. */}
          <button
            type="button"
            onClick={() => onRetrieve(order.id)}
            disabled={pending}
            className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2.5} />
            Marquer récupérée
          </button>
        </div>
      )}
    </div>
  );
}
