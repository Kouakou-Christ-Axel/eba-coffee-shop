// components/payment-method-badge.tsx
//
// Affichage unique d'un moyen de paiement : logo de la marque, ou icône
// générique pour CASH/OTHER (pas de marque). Seul endroit qui connaît ce
// mapping (`PAYMENT_MODE_LOGOS` dans `lib/payment-modes.ts`) — tous les sites
// d'affichage (caisse, détail commande, filtres, stats) passent par ici.

import Image from 'next/image';
import { Banknote, MoreHorizontal } from 'lucide-react';
import type { PaymentMode } from '@/generated/prisma/client';
import { PAYMENT_MODE_LABELS, PAYMENT_MODE_LOGOS } from '@/lib/payment-modes';
import { cn } from '@/lib/utils';

const FALLBACK_ICONS: Partial<Record<PaymentMode, typeof Banknote>> = {
  CASH: Banknote,
  OTHER: MoreHorizontal,
};

type PaymentMethodIconProps = {
  mode: PaymentMode;
  className?: string;
};

/** Le logo (ou l'icône de repli) seul, sans libellé. */
export function PaymentMethodIcon({ mode, className }: PaymentMethodIconProps) {
  const logo = PAYMENT_MODE_LOGOS[mode];
  if (logo) {
    return (
      <Image
        src={logo}
        alt={PAYMENT_MODE_LABELS[mode]}
        width={20}
        height={20}
        className={cn('h-5 w-5 shrink-0 object-contain', className)}
      />
    );
  }
  const Icon = FALLBACK_ICONS[mode] ?? MoreHorizontal;
  return (
    <Icon
      aria-hidden="true"
      className={cn('h-5 w-5 shrink-0', className)}
      strokeWidth={1.75}
    />
  );
}

type PaymentMethodBadgeProps = PaymentMethodIconProps & {
  labelClassName?: string;
};

/** Logo/icône + libellé — l'affichage par défaut d'un moyen de paiement. */
export function PaymentMethodBadge({
  mode,
  className,
  labelClassName,
}: PaymentMethodBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <PaymentMethodIcon mode={mode} />
      <span className={labelClassName}>{PAYMENT_MODE_LABELS[mode]}</span>
    </span>
  );
}
