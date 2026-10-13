'use client';

import type { ReactNode } from 'react';
import { differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { READY_WAIT_ALERT_MINUTES } from '@/config/constants';
import { TrackingLinkButton } from '@/components/(dashboard)/tracking-link-button';
import { formatLocalDateOnly } from '@/lib/timezone';
import type { CashierOrder } from '@/lib/cashier-queue';
import { getPickupCode } from '@/lib/orders/format';
import { buildTelLink } from '@/lib/contact-links';
import {
  formatElapsedShort,
  isPickupOverdue,
  isScheduledAhead,
  URGENCY_STYLES,
  type UrgencyLevel,
} from './urgency';
import { OrderCardAlerts } from './_components/card/order-card-alerts';
import { OrderCardHeader } from './_components/card/order-card-header';
import { OrderProgress } from './_components/card/order-progress';
import { OrderCardItems } from './_components/card/order-card-items';
import { ORDER_TYPE_META } from './_components/card/meta';
import { getPaymentBadge } from './_components/card/payment-badge';

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
  // Minuteur « prête, en attente » ; repli sur createdAt pour les commandes prêtes avant l'ajout de `readyAt`.
  const readySince =
    order.status === 'READY' ? (order.readyAt ?? order.createdAt) : null;
  const readyMinutes = readySince
    ? Math.max(0, differenceInMinutes(tickNow, readySince))
    : null;
  const readyLate =
    readyMinutes != null && readyMinutes >= READY_WAIT_ALERT_MINUTES;
  // Autre jour civil : on date le n° pour éviter la collision avec le #003 du jour.
  const otherDay =
    formatLocalDateOnly(order.createdAt) !== formatLocalDateOnly(tickNow);
  const driverTelLink = buildTelLink(order.driverPhone);
  // Retrait lointain (urgence « normal ») : bordure indigo dédiée ; l'urgence de proximité reprend ensuite.
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
      <OrderCardHeader
        order={order}
        typeLabel={typeMeta.label}
        TypeIcon={TypeIcon}
        otherDay={otherDay}
        pickupCode={pickupCode}
        payment={payment}
        urgencyStyle={urgencyStyle}
        elapsed={elapsed}
        tickNow={tickNow}
      />
      <OrderProgress order={order} />
      <OrderCardAlerts
        order={order}
        readyMinutes={readyMinutes}
        readyLate={readyLate}
        overdue={overdue}
        driverTelLink={driverTelLink}
        now={tickNow}
      />
      <OrderCardItems order={order} />

      {/* Lien de suivi (partage client / livreur) ; masqué une fois la commande terminée ou annulée. */}
      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <TrackingLinkButton orderId={order.id} className="mt-3" />
      )}

      {/* Slot actions */}
      {actions && <div className="mt-3">{actions}</div>}
    </article>
  );
}
