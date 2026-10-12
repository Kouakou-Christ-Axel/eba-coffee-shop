'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PaymentBadge } from './payment-badge';

export function PaymentBadgePill({ payment }: { payment: PaymentBadge }) {
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
    'on-account': {
      label: 'Ardoise',
      className:
        'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100',
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

  const label =
    payment.kind === 'paid' && payment.split
      ? 'Payée · fractionné'
      : config.label;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className
      )}
    >
      {label}
      {/* Encaissement posé automatiquement par l'IA (verdict MATCH) — pas un
          geste caisse. Le bouton d'annulation dédié est dans les actions. */}
      {payment.kind === 'paid' && payment.autoValidatedByAi && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-white/60 px-1 py-0.5 text-[10px] font-semibold dark:bg-black/20"
          title="Encaissement validé automatiquement par l’IA"
        >
          <Bot className="h-2.5 w-2.5" aria-hidden="true" />
          IA
        </span>
      )}
    </span>
  );
}
