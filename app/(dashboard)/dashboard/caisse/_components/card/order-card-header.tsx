'use client';

import { Bike, CalendarClock, Clock, Handshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPickup, URGENCY_STYLES, type UrgencyLevel } from '../../urgency';
import { PaymentBadgePill } from './payment-badge-pill';
import { dayFormatter } from './format';
import { SOURCE_META } from './meta';
import type { CashierOrder } from '@/lib/cashier-queue';
import type { PaymentBadge } from './payment-badge';

export function OrderCardHeader({
  order,
  typeLabel,
  TypeIcon,
  otherDay,
  pickupCode,
  payment,
  urgencyStyle,
  elapsed,
  tickNow,
}: {
  order: CashierOrder;
  typeLabel: string;
  TypeIcon: typeof Bike;
  otherDay: boolean;
  pickupCode: string;
  payment: PaymentBadge;
  urgencyStyle: (typeof URGENCY_STYLES)[UrgencyLevel];
  elapsed: string;
  tickNow: Date;
}) {
  return (
    <>
      {/* Ligne 1 : type icon + numéro + nom + badge paiement */}
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <TypeIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-label={typeLabel}
          />
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-1.5 text-base font-semibold leading-tight">
              <span className="shrink-0 font-mono">
                #{String(order.dailyNumber).padStart(3, '0')}
                {otherDay && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {dayFormatter.format(order.createdAt)}
                  </span>
                )}
              </span>
              <span
                className="shrink-0 rounded bg-primary/10 px-1.5 font-mono text-sm text-primary"
                title={`Code de retrait · ${order.reference}`}
              >
                {pickupCode}
              </span>
              <span className="min-w-0 truncate">
                {order.customerName ?? 'Client anonyme'}
              </span>
              {/* Client de confiance : explique pourquoi la commande est partie en cuisine sans être payée. */}
              {order.customerTrusted && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                  title="Client de confiance — ardoise autorisée"
                >
                  <Handshake className="h-3 w-3" aria-hidden="true" />
                  Confiance
                </span>
              )}
              {SOURCE_META[order.source] && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title={
                    order.source === 'ONLINE'
                      ? 'Commande passée par le client sur le site'
                      : 'Commande saisie via l’outil MCP (rétroactive)'
                  }
                >
                  {(() => {
                    const { Icon, label } = SOURCE_META[order.source]!;
                    return (
                      <>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {label}
                      </>
                    );
                  })()}
                </span>
              )}
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
              {order.pickupTime && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  Planifiée · {formatPickup(order.pickupTime, tickNow)}
                </span>
              )}
            </p>
          </div>
        </div>
        <PaymentBadgePill payment={payment} />
      </header>
    </>
  );
}
