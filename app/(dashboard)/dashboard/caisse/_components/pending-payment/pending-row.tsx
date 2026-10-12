'use client';

import { Ban, HandCoins, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildPaymentReminderMessage,
  buildTelLink,
  buildWhatsAppLink,
} from '@/lib/contact-links';
import { getPickupCode } from '@/lib/orders/format';
import { formatRetryDeadline } from '@/lib/orders/payment-panel';
import { priceFormatter } from './format';
import type { PendingOrder } from './types';

export function PendingRow({
  order: o,
  now,
  busy,
  confirmingCancel,
  onTake,
  onAskCancel,
  onCancel,
  onKeep,
}: {
  order: PendingOrder;
  now: number;
  busy: boolean;
  confirmingCancel: boolean;
  onTake: () => void;
  onAskCancel: () => void;
  onCancel: () => void;
  onKeep: () => void;
}) {
  const deadline = formatRetryDeadline(o.paymentExpiresAt);
  const overdue = new Date(o.paymentExpiresAt).getTime() < now;
  const tel = buildTelLink(o.customerPhone);
  const whatsapp = buildWhatsAppLink(
    o.customerPhone,
    buildPaymentReminderMessage({
      customerName: o.customerName,
      dailyNumber: o.dailyNumber,
      trackingUrl: `${window.location.origin}/commande/${o.id}`,
      deadline,
    })
  );

  return (
    <li className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-mono text-xl font-bold leading-none">
          #{String(o.dailyNumber).padStart(3, '0')}
          <span
            className="rounded bg-primary/10 px-1.5 py-0.5 text-base text-primary"
            title="Code de retrait"
          >
            {getPickupCode(o.reference)}
          </span>
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {o.customerName ?? 'Client anonyme'}
          {o.customerPhone ? ` · ${o.customerPhone}` : ''}
        </p>
        <p className="text-sm text-muted-foreground">
          {priceFormatter.format(o.total)} FCFA ·{' '}
          <span className={overdue ? 'font-semibold text-amber-600' : ''}>
            {overdue ? 'délai dépassé' : `jusqu’à ${deadline}`}
          </span>
          {o.paymentAttempts > 1 ? ` · ${o.paymentAttempts} tentatives` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tel && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={tel}>
              <Phone className="h-4 w-4" />
              Appeler
            </a>
          </Button>
        )}
        {whatsapp && (
          <Button asChild variant="outline" className="min-h-11">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Relancer
            </a>
          </Button>
        )}
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={onTake}
        >
          <HandCoins className="h-4 w-4" />
          Prendre en caisse
        </Button>
        {confirmingCancel ? (
          <>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={busy}
              onClick={onCancel}
            >
              Confirmer l’annulation
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={onKeep}
            >
              Garder
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={busy}
            onClick={onAskCancel}
          >
            <Ban className="h-4 w-4" />
            Annuler
          </Button>
        )}
      </div>
    </li>
  );
}
