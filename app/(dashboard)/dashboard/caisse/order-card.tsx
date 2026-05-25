'use client';

import type { ReactNode } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bike,
  Coffee,
  ShoppingBag,
  StickyNote,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { OrderType } from '@/generated/prisma/client';

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
  | { kind: 'pay-after' };

function getPaymentBadge(order: CashierOrder): PaymentBadge {
  if (order.isPaid) return { kind: 'paid' };
  if (order.status === 'PREPARING' || order.status === 'READY') {
    return { kind: 'pay-after' };
  }
  return { kind: 'unpaid' };
}

type Props = {
  order: CashierOrder;
  actions?: ReactNode;
};

export function OrderCard({ order, actions }: Props) {
  const typeMeta = ORDER_TYPE_META[order.orderType];
  const TypeIcon = typeMeta.Icon;
  const payment = getPaymentBadge(order);
  const elapsed = formatDistanceToNowStrict(order.createdAt, {
    locale: fr,
    addSuffix: true,
  });

  const itemsSummary = order.items
    .map((i) => `${i.quantity}× ${i.productName}`)
    .join(' · ');

  return (
    <article className="animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Ligne 1 : type icon + numéro + nom + badge paiement */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {order.customerPhone ?? '—'}
              <span className="px-1.5">·</span>
              {elapsed}
            </p>
          </div>
        </div>
        <PaymentBadgePill payment={payment} />
      </header>

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

      {/* Slot actions (Phase 3) */}
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
