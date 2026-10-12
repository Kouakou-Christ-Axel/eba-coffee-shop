'use client';

import { Button } from '@heroui/react';
import { Share2 } from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import { formatPickupTime } from '@/lib/format-order';
import {
  buildTrackingShareMessage,
  buildWhatsAppShareLink,
} from '@/lib/contact-links';

export function PickupCodeCard({
  order,
  pickupCode,
  isFinal,
  trackingUrl,
}: {
  order: PublicOrderView;
  pickupCode: string;
  isFinal: boolean;
  trackingUrl: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-default-50 p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
        Code de retrait
      </p>
      <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
        {pickupCode}
      </p>
      <p className="mt-1 font-mono text-xs text-foreground/40">
        {order.reference}
      </p>
      <p className="mt-2 text-xs text-foreground/60">
        À annoncer au comptoir (par toi ou ton livreur) pour retirer la
        commande.
      </p>
      <p className="mt-2 text-sm">
        <span className="text-foreground/50">Retrait&nbsp;:</span>{' '}
        {order.pickupTime
          ? formatPickupTime(new Date(order.pickupTime))
          : 'dès que prêt'}
      </p>
      {/* Garder le lien : cette URL n'est montrée qu'ici — l'envoyer sur
            WhatsApp (à soi-même ou un proche) évite de la perdre en fermant
            l'onglet. Complémentaire de /mes-commandes (même appareil). */}
      {!isFinal && trackingUrl && (
        <Button
          as="a"
          href={buildWhatsAppShareLink(
            buildTrackingShareMessage({
              pickupCode,
              customerName: order.customerName,
              trackingUrl,
            })
          )}
          target="_blank"
          rel="noopener noreferrer"
          variant="bordered"
          size="sm"
          className="mt-4"
          startContent={<Share2 className="h-3.5 w-3.5" />}
        >
          Partager le lien de suivi
        </Button>
      )}
    </div>
  );
}
