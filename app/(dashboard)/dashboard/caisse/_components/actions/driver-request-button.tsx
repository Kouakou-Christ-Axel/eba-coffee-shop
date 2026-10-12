'use client';

import { Bike, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatElapsedShort } from '../../urgency';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderActions } from './use-order-actions';
import type { OrderView } from './use-order-view';

/** « Demander le livreur » : WhatsApp pré-rempli au client + drapeau partagé avec la cuisine. */
export function DriverRequestButton({
  order,
  view,
  actions,
}: {
  order: CashierOrder;
  view: OrderView;
  actions: OrderActions;
}) {
  const { driverLink, tickNow } = view;
  const { pendingAction, isPending, handleRequestDriver } = actions;
  const requested = order.driverRequested;
  const loading = pendingAction === 'driver-request';
  const label = requested
    ? `Livreur demandé${order.driverRequestedAt ? ` · ${formatElapsedShort(order.driverRequestedAt, tickNow)}` : ''}`
    : 'Demander le livreur';
  const tone = requested
    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
    : 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100';
  const icon = loading ? (
    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
  ) : (
    <Bike className="mr-1.5 h-4 w-4" />
  );

  // Avec un téléphone client : le lien ouvre WhatsApp ET pose le drapeau au même clic.
  if (driverLink) {
    return (
      <Button asChild variant="outline" size="lg" className={`w-full ${tone}`}>
        <a
          href={driverLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            if (!requested && !isPending) handleRequestDriver();
          }}
        >
          {icon}
          {label}
        </a>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={`w-full ${tone}`}
      disabled={isPending || requested}
      onClick={handleRequestDriver}
    >
      {icon}
      {label}
    </Button>
  );
}
