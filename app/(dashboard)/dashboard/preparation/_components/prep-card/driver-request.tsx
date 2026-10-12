'use client';

import { Bike } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildDriverRequestMessage,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import type { PreparationOrder } from '@/lib/preparation-queue';
import type { ContactSettings } from '@/lib/contact-settings';

export function DriverRequest({
  order,
  pending,
  contactSettings,
  onRequestDriver,
}: {
  order: PreparationOrder;
  pending: boolean;
  contactSettings: Pick<ContactSettings, 'yangoLandmark' | 'phone'>;
  onRequestDriver: (id: string) => void;
}) {
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
    <div className="px-3 pb-1">
      {driverLink ? (
        // Ouvre WhatsApp avec le message pré-rempli ET pose le drapeau
        // `driverRequested` (bandeau lu par la caisse) dans le même geste.
        <a
          href={driverLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            if (!order.driverRequested) onRequestDriver(order.id);
          }}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
            order.driverRequested
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
          )}
        >
          <Bike className="h-3.5 w-3.5" />
          {order.driverRequested ? 'Livreur demandé' : 'Demander le livreur'}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => onRequestDriver(order.id)}
          disabled={pending || order.driverRequested}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition-colors',
            order.driverRequested
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/40'
          )}
        >
          <Bike className="h-3.5 w-3.5" />
          {order.driverRequested ? 'Livreur demandé' : 'Demander le livreur'}
        </button>
      )}
    </div>
  );
}
