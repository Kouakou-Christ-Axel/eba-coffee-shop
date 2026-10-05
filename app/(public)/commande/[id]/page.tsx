// app/(public)/commande/[id]/page.tsx
//
// Page publique de suivi de commande. Le serveur charge l'état initial
// (+ réglages de retrait) ; <OrderTracking> prend le relais côté client
// (polling du statut, bloc livreur, paiement en ligne Jèko, partage).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicOrder } from '@/lib/orders';
import { getPickupSettings } from '@/lib/pickup-settings-db';
import { getContactSettings } from '@/lib/contact-settings-db';
import { OrderTracking } from '@/components/(public)/commande/order-tracking';
import { parsePaymentReturn } from '@/lib/orders/payment-panel';
import { expirePendingOrders } from '@/lib/jeko/expiry';

export const metadata: Metadata = {
  title: 'Suivi de commande — EBA Coffee Shop',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  // `?paiement=ok|echec` : retour de chez Jèko (cf. lib/jeko/start-payment.ts).
  searchParams: Promise<{ paiement?: string | string[] }>;
};

export default async function CommandePage({ params, searchParams }: Props) {
  const { id } = await params;
  const paymentReturn = parsePaymentReturn((await searchParams).paiement);
  // Nettoyage opportuniste des commandes en attente expirées (pas de cron) : les
  // clients qui suivent leur commande suffisent à le déclencher, même si le staff
  // n'ouvre aucun écran. Idempotent, au plus une fois par minute, jamais bloquant.
  void expirePendingOrders().catch(() => {});
  const [order, settings, contact] = await Promise.all([
    getPublicOrder(id),
    getPickupSettings(),
    getContactSettings(),
  ]);

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-28 sm:pt-32">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">
          {order.status === 'CANCELLED'
            ? !order.isPaid && order.payment.state === 'expired'
              ? 'Paiement expiré'
              : 'Commande annulée'
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
        whatsapp={contact.whatsapp}
        paymentReturn={paymentReturn}
      />

      <div className="mt-8 flex items-center justify-center gap-6 text-center">
        <Link
          href="/carte"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          ← Retour à la carte
        </Link>
        <Link
          href="/mes-commandes"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Mes commandes
        </Link>
      </div>
    </div>
  );
}
