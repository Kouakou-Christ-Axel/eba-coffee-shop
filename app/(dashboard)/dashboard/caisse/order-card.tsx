'use client';

import type { ReactNode } from 'react';
import {
  Bike,
  Coffee,
  ShoppingBag,
  StickyNote,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderType } from '@/generated/prisma/client';
import {
  formatElapsedShort,
  isPickupOverdue,
  URGENCY_STYLES,
  type UrgencyLevel,
} from './urgency';

const priceFormatter = new Intl.NumberFormat('fr-FR');

const ORDER_TYPE_META: Record<OrderType, { label: string; Icon: typeof Bike }> =
  {
    DELIVERY: { label: 'Livraison', Icon: Bike },
    DINE_IN: { label: 'Sur place', Icon: Coffee },
    TAKEAWAY: { label: 'À emporter', Icon: ShoppingBag },
  };

type PaymentBadge =
  | { kind: 'paid' }
  | { kind: 'unpaid' }
  | { kind: 'pay-after' }
  | { kind: 'pickup-unpaid' };

function getPaymentBadge(order: CashierOrder): PaymentBadge {
  if (order.isPaid) return { kind: 'paid' };
  // Récupérée mais toujours pas encaissée : à signaler clairement.
  if (order.status === 'COMPLETED') return { kind: 'pickup-unpaid' };
  if (order.status === 'PREPARING' || order.status === 'READY') {
    return { kind: 'pay-after' };
  }
  return { kind: 'unpaid' };
}

type Props = {
  order: CashierOrder;
  urgency?: UrgencyLevel;
  now?: Date;
  actions?: ReactNode;
};

export function OrderCard({ order, urgency = 'normal', now, actions }: Props) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const payment = getPaymentBadge(order);
  const tickNow = now ?? new Date();
  const elapsed = formatElapsedShort(order.createdAt, tickNow);
  const overdue = isPickupOverdue(order, tickNow);
  const urgencyStyle = URGENCY_STYLES[urgency];

  const itemsSummary = order.items
    .map(
      (i) => `${i.quantity}× ${i.productName}${i.addedLater ? ' (ajout)' : ''}`
    )
    .join(' · ');

  return (
    <article
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-2xl border-2 bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        urgencyStyle.borderClass
      )}
    >
      {/* Ligne 1 : type icon + numéro + nom + badge paiement */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TypeIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-label={typeMeta.label}
          />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight">
              <span className="font-mono">
                #{String(order.dailyNumber).padStart(3, '0')}
              </span>
              <span className="px-1.5 text-muted-foreground">·</span>
              <span className="truncate">
                {order.customerName ?? 'Client anonyme'}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
              {order.customerPhone && (
                <>
                  <span className="text-muted-foreground">
                    {order.customerPhone}
                  </span>
                  <span className="text-muted-foreground">·</span>
                </>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 tabular-nums',
                  urgencyStyle.textClass
                )}
              >
                <Clock className="h-3 w-3" aria-hidden="true" />
                {elapsed}
              </span>
            </p>
          </div>
        </div>
        <PaymentBadgePill payment={payment} />
      </header>

      {/* Override pickupTime dépassé */}
      {overdue && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Créneau de retrait dépassé
            {order.pickupTime && (
              <>
                {' '}
                (
                {order.pickupTime.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                )
              </>
            )}
          </span>
        </div>
      )}

      {/* Signal cuisine "demander livreur" */}
      {order.driverRequested && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 ring-1 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
          <AlertTriangle
            className="h-4 w-4 shrink-0 animate-pulse"
            aria-hidden="true"
          />
          <span>La cuisine demande d&apos;appeler le livreur</span>
        </div>
      )}

      {/* Note client */}
      {order.note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-amber-500 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{order.note}</span>
        </div>
      )}

      {/* Ligne items + total */}
      <p className="mt-3 text-sm text-foreground/80">
        <span className="text-foreground">{itemsSummary}</span>
        <span className="px-1.5 text-muted-foreground">·</span>
        <span className="font-semibold tabular-nums">
          {priceFormatter.format(order.total)} F
        </span>
      </p>

      {/* Slot actions */}
      {actions && <div className="mt-3">{actions}</div>}
    </article>
  );
}

function PaymentBadgePill({ payment }: { payment: PaymentBadge }) {
  const config = {
    paid: {
      label: 'Payée',
      className:
        'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100',
    },
    unpaid: {
      label: 'Non payé',
      className:
        'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100',
    },
    'pay-after': {
      label: 'À encaisser après',
      className:
        'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100',
    },
    'pickup-unpaid': {
      label: 'Récupérée · à encaisser',
      className:
        'bg-red-100 text-red-900 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-100 dark:ring-red-800',
    },
  }[payment.kind];

  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
