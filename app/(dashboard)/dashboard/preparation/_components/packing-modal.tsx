'use client';

import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
} from '@heroui/react';
import { Package, PackageCheck, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import type { PreparationOrder } from '@/lib/preparation-queue';
import { elapsedMinutes, formatElapsed } from './elapsed';

type Props = {
  orders: PreparationOrder[];
  now: Date;
};

/**
 * Bouton (bien placé, flottant sur mobile) ouvrant un modal d'emballage /
 * historique du jour en cuisine : les commandes prêtes à emballer/remettre
 * (READY) et celles encore en préparation, avec leur code de retrait.
 *
 * But (précisé produit) : permettre à la cuisine d'emballer les commandes
 * prêtes en retrouvant vite leur code, même loin de l'écran principal.
 */
export function PackingModal({ orders, now }: Props) {
  const [open, setOpen] = useState(false);

  const ready = orders.filter((o) => o.status === 'READY');
  const preparing = orders.filter((o) => o.status === 'PREPARING');

  return (
    <>
      {/* Bouton flottant : coin bas-droit, doigt facile sur mobile. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
        aria-label="Emballage & retraits"
      >
        <Package className="h-5 w-5" />
        <span>Emballage</span>
        {ready.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-xs">
            {ready.length}
          </span>
        )}
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        placement="center"
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex-col items-start gap-0.5">
            <span className="text-lg font-semibold">Emballage & retraits</span>
            <span className="text-xs font-normal text-muted-foreground">
              Commandes du jour passées en cuisine · codes de retrait
            </span>
          </ModalHeader>
          <ModalBody className="gap-4 pb-6">
            {/* À emballer / remettre (prêtes) */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-green-700 dark:text-green-400">
                <PackageCheck className="h-4 w-4" />À remettre ({ready.length})
              </h3>
              {ready.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucune commande prête pour l&apos;instant.
                </p>
              ) : (
                <ul className="space-y-2">
                  {ready.map((o) => (
                    <PackingRow key={o.id} order={o} now={now} ready />
                  ))}
                </ul>
              )}
            </section>

            {/* En préparation */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground">
                <ChefHat className="h-4 w-4" />
                En préparation ({preparing.length})
              </h3>
              {preparing.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Rien en préparation.
                </p>
              ) : (
                <ul className="space-y-2">
                  {preparing.map((o) => (
                    <PackingRow key={o.id} order={o} now={now} />
                  ))}
                </ul>
              )}
            </section>

            <Button variant="flat" onPress={() => setOpen(false)}>
              Fermer
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

function PackingRow({
  order,
  now,
  ready = false,
}: {
  order: PreparationOrder;
  now: Date;
  ready?: boolean;
}) {
  const since = ready
    ? (order.readyAt ?? order.createdAt)
    : (order.preparingStartedAt ?? order.createdAt);
  const mins = elapsedMinutes(since, now);
  const late = ready && mins >= READY_WAIT_ALERT_MINUTES;

  return (
    <li className="rounded-lg border bg-card p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-baseline gap-1.5 font-mono text-sm font-bold">
            #{String(order.dailyNumber).padStart(3, '0')}
            <span className="rounded bg-primary/10 px-1.5 text-primary">
              {getPickupCode(order.reference)}
            </span>
            <span className="truncate font-sans font-medium text-foreground">
              {order.customerName ?? 'Client anonyme'}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {order.items
              .map(
                (i) =>
                  `${i.quantity}× ${i.productName}` +
                  (i.supplements.length
                    ? ` (${i.supplements.map(formatSupplementLabel).join(', ')})`
                    : '')
              )
              .join(' · ')}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
            late
              ? 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {ready ? 'prête ' : ''}
          {formatElapsed(mins)}
        </span>
      </div>
      {ready && <TrackingLinkButton orderId={order.id} className="mt-2" />}
    </li>
  );
}
