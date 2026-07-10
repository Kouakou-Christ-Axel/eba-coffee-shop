'use client';

import type { ReactNode } from 'react';
import { differenceInMinutes } from 'date-fns';
import {
  Bike,
  Coffee,
  ShoppingBag,
  StickyNote,
  AlertTriangle,
  CalendarClock,
  Clock,
  Phone,
  Receipt,
  PackageCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import {
  ABIDJAN_TZ,
  formatAbidjanTime,
  formatLocalDateOnly,
} from '@/lib/timezone';
import type { CashierOrder } from '@/lib/cashier-queue';
import { getItemGross, getItemNet } from '@/lib/orders/totals';
import { formatSupplementLabel, getPickupCode } from '@/lib/orders/format';
import { buildTelLink } from '@/lib/contact-links';
import type { OrderType } from '@/generated/prisma/client';
import {
  formatElapsedShort,
  formatPickup,
  isPickupOverdue,
  isScheduledAhead,
  URGENCY_STYLES,
  type UrgencyLevel,
} from './urgency';

const priceFormatter = new Intl.NumberFormat('fr-FR');

// « sam. 05/07 » — pour dater le n° du jour d'une commande d'un AUTRE jour
// (le #003 repart à 1 chaque matin : sans la date, deux jours se confondent).
const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ABIDJAN_TZ,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

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
  const scheduledAhead = isScheduledAhead(order, tickNow);
  const pickupCode = getPickupCode(order.reference);
  // Minuteur « prête, en attente de récupération » : le client tarde souvent à
  // venir (« fait la star »). On repli sur createdAt pour les commandes prêtes
  // avant l'ajout de readyAt.
  const readySince =
    order.status === 'READY' ? (order.readyAt ?? order.createdAt) : null;
  const readyMinutes = readySince
    ? Math.max(0, differenceInMinutes(tickNow, readySince))
    : null;
  const readyLate =
    readyMinutes != null && readyMinutes >= READY_WAIT_ALERT_MINUTES;
  // Commande rattachée à un autre jour civil (ex. passée hier pour un retrait
  // aujourd'hui) : on date son n° pour éviter la collision avec le #003 du jour.
  const otherDay =
    formatLocalDateOnly(order.createdAt) !== formatLocalDateOnly(tickNow);
  const driverTelLink = buildTelLink(order.driverPhone);
  // Tant que le retrait est lointain (urgence « normal »), une bordure indigo dédiée
  // signale la commande programmée ; l'urgence de proximité reprend la main ensuite.
  const borderClass =
    scheduledAhead && urgency === 'normal'
      ? 'border-indigo-300 dark:border-indigo-800'
      : urgencyStyle.borderClass;

  return (
    <article
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-2 duration-300 rounded-2xl border-2 bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        borderClass
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

      {/* Prête, en attente de récupération : minuteur « prête depuis X ».
          Rouge quand le client tarde (fait la star), vert sinon. */}
      {readyMinutes != null && (
        <div
          className={cn(
            'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ring-1',
            readyLate
              ? 'bg-red-100 text-red-900 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800'
              : 'bg-green-100 text-green-900 ring-green-300 dark:bg-green-950/40 dark:text-green-100 dark:ring-green-800'
          )}
        >
          <PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Prête depuis {readyMinutes} min — en attente de récupération
            {readyLate && ' · relancer le client'}
          </span>
        </div>
      )}

      {/* Override pickupTime dépassé */}
      {overdue && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 ring-1 ring-red-300 dark:bg-red-950/40 dark:text-red-100 dark:ring-red-800">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Créneau de retrait dépassé
            {order.pickupTime && <> ({formatAbidjanTime(order.pickupTime)})</>}
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

      {/* Livreur annoncé par le client (page de suivi) */}
      {(order.driverName || order.driverPhone) && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900 ring-1 ring-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-800">
          <Bike className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            Livreur&nbsp;: {order.driverName ?? 'sans nom'}
          </span>
          {order.driverPhone &&
            (driverTelLink ? (
              <a
                href={driverTelLink}
                className="ml-auto inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
              >
                <Phone className="h-3 w-3" aria-hidden="true" />
                {order.driverPhone}
              </a>
            ) : (
              <span className="ml-auto shrink-0">{order.driverPhone}</span>
            ))}
        </div>
      )}

      {/* Preuve de paiement envoyée par le client, en attente de validation */}
      {order.paymentProofUrl && !order.isPaid && (
        <a
          href={order.paymentProofUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 ring-1 ring-emerald-300 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-800"
        >
          <Receipt className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Preuve de paiement Wave reçue — appuyer pour vérifier</span>
        </a>
      )}

      {/* Note client */}
      {order.note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-amber-500 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{order.note}</span>
        </div>
      )}

      {/* Détail des articles (avec options choisies) + total */}
      <div className="mt-3 text-sm">
        <ul className="space-y-1.5">
          {order.items.map((item) => {
            const gross = getItemGross(item);
            const net = getItemNet(item);
            const discounted = gross !== net;
            return (
              <li key={item.cartId} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-1.5 text-foreground">
                    <span className="font-medium tabular-nums">
                      {item.quantity}×
                    </span>
                    <span>{item.productName}</span>
                    {item.addedLater && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Ajout
                      </span>
                    )}
                  </span>
                  {item.supplements.length > 0 && (
                    <span className="block pl-5 text-xs text-muted-foreground">
                      {item.supplements.map(formatSupplementLabel).join(' · ')}
                    </span>
                  )}
                  {discounted && (
                    <span className="block pl-5 text-xs font-medium text-green-700 dark:text-green-400">
                      Remise -{priceFormatter.format(gross - net)} F
                      {item.discountReason ? ` (${item.discountReason})` : ''}
                    </span>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">
                  {discounted && (
                    <span className="mr-1 text-xs text-muted-foreground line-through">
                      {priceFormatter.format(gross)}
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {priceFormatter.format(net)} F
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 border-t pt-2 text-right font-semibold tabular-nums">
          {priceFormatter.format(order.total)} F
        </p>
      </div>

      {/* Lien de suivi de la commande, accessible directement (partage client /
          livreur). Masqué une fois la commande terminée ou annulée. */}
      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <TrackingLinkButton orderId={order.id} className="mt-3" />
      )}

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
