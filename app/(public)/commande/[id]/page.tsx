// app/(public)/commande/[id]/page.tsx
//
// Page publique de suivi de commande. Le serveur charge l'état initial
// (+ réglages de retrait) ; <OrderTracking> prend le relais côté client
// (polling du statut, bloc livreur, paiement Wave + preuve, partage).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicOrder } from '@/lib/orders';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { OrderTracking } from '@/components/(public)/commande/order-tracking';

export const metadata: Metadata = {
  title: 'Suivi de commande — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function CommandePage({ params }: Props) {
  const { id } = await params;
  const [order, settings] = await Promise.all([
    getPublicOrder(id),
    getPickupSettings(),
  ]);

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">
          {order.status === 'CANCELLED'
            ? 'Commande annulée'
            : order.status === 'COMPLETED'
              ? 'Commande récupérée'
              : 'Suivi de ta commande'}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Bonjour {order.customerName ?? 'cher client'}, garde cette page
          ouverte&nbsp;: elle se met à jour automatiquement.
        </p>
      </div>

      <OrderTracking
        initialOrder={order}
        pickupAddress={settings.pickupAddress ?? null}
        pickupMapsUrl={settings.pickupMapsUrl ?? null}
      />

      <div className="mt-8 text-center">
        <Link
          href="/carte"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Retour à la carte
        </Link>
      </div>
    </div>
  );
}
