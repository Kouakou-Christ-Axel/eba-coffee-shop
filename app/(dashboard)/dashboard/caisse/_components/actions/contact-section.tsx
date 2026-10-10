'use client';

import { Phone, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyRecapButton } from '../../../_components/copy-recap-button';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { CaisseContactSettings } from './types';
import type { OrderView } from './use-order-view';

export function ContactSection({
  order,
  view,
  contactSettings,
}: {
  order: CashierOrder;
  view: OrderView;
  contactSettings: CaisseContactSettings;
}) {
  const { phone, telLink, trackingUrl, loyaltyTeaser, whatsappLink } = view;
  return (
    <>
      {/* Ligne contact : Appeler + Wave (2 colonnes) */}
      {phone && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!telLink}
          >
            {telLink ? (
              <a href={telLink}>
                <Phone className="mr-1.5 h-4 w-4" />
                Appeler
              </a>
            ) : (
              <span>Appeler</span>
            )}
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full"
            disabled={!whatsappLink}
          >
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Wave
              </a>
            ) : (
              <span>Wave</span>
            )}
          </Button>
        </div>
      )}

      {/* Copier le récap + lien Wave (fonctionne même sans téléphone) */}
      <CopyRecapButton
        customerName={order.customerName}
        dailyNumber={order.dailyNumber}
        reference={order.reference}
        amount={order.total}
        items={order.items}
        loyaltyDiscount={order.loyaltyDiscount}
        contactSettings={contactSettings}
        trackingUrl={trackingUrl}
        loyaltyTeaser={loyaltyTeaser}
      />
    </>
  );
}
