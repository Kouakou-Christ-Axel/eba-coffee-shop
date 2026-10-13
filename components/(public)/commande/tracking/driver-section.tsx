'use client';

import { Button } from '@heroui/react';
import { m, useReducedMotion } from 'framer-motion';
import { Bike, Share2 } from 'lucide-react';
import type { PublicOrderView } from '@/lib/orders';
import {
  buildDriverShareMessage,
  buildWhatsAppShareLink,
} from '@/lib/contact-links';

export function DriverSection({
  order,
  isFinal,
  pickupAddress,
  pickupMapsUrl,
  pickupCode,
  trackingUrl,
}: {
  order: PublicOrderView;
  isFinal: boolean;
  pickupAddress: string | null;
  pickupMapsUrl: string | null;
  pickupCode: string;
  trackingUrl: string;
}) {
  const isReady = order.status === 'READY';
  const reduceMotion = useReducedMotion();

  // Le client n'identifie plus son livreur : il lui suffit de lui transférer
  // le code de retrait (WhatsApp ouvre le sélecteur de contact).
  const shareMessage = buildDriverShareMessage({
    pickupCode,
    customerName: order.customerName,
    pickupAddress,
    pickupMapsUrl,
    trackingUrl,
  });
  const shareLink = buildWhatsAppShareLink(shareMessage);

  // Avant que la commande soit prête, on ne montre ni formulaire ni partage
  // — rien à faire tant que le livreur ne peut pas encore venir chercher la
  // commande. La section complète apparaît dès le passage à READY.
  if (!isFinal && !isReady) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-default-50 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
          <Bike className="h-4 w-4" />
          Ton livreur
        </p>
        <p className="mt-3 text-sm text-foreground/60">
          On te préviendra dès que ta commande est prête pour envoyer ton
          livreur. Cette page se met à jour toute seule.
        </p>
      </div>
    );
  }

  return (
    <m.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-foreground/10 bg-default-50 p-5"
    >
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/40">
        <Bike className="h-4 w-4" />
        Ton livreur
      </p>

      {/* Message contextuel : la commande est prête. */}
      {!isFinal && (
        <div className="mt-3 rounded-lg bg-success/15 px-3 py-2 text-sm font-medium text-success-700 dark:text-success">
          C’est prêt ! Tu peux envoyer ton livreur dès maintenant.
        </div>
      )}

      {/* Transfert au livreur : code + adresse + Maps + lien de suivi. */}
      {!isFinal && trackingUrl && (
        <Button
          as="a"
          href={shareLink}
          target="_blank"
          rel="noopener noreferrer"
          variant="bordered"
          size="lg"
          className="mt-4 w-full"
          startContent={<Share2 className="h-4 w-4" />}
        >
          Partager au livreur sur WhatsApp
        </Button>
      )}
    </m.div>
  );
}
