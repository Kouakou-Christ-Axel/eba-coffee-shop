// lib/refunds/destination.ts
//
// Où et comment l'argent repart : canal, mode d'envoi, numéro. Un transfert Jèko
// n'existe que pour les moyens mobiles proposés au checkout.

import type { PaymentMode } from '@/generated/prisma/client';
import { normalizeIvorianPhone } from '@/lib/phone';
import { JEKO_TO_PAYMENT_MODE } from '@/lib/jeko/payment-methods';
import type { JekoPaymentMethod } from '@/lib/jeko/payment-methods';
import { RefundError } from './errors';

const MODE_TO_JEKO = Object.fromEntries(
  Object.entries(JEKO_TO_PAYMENT_MODE).map(([method, mode]) => [mode, method])
) as Partial<Record<PaymentMode, JekoPaymentMethod>>;

/** Méthode de transfert Jèko d'un canal, ou null (espèces, « Autre »…). */
export function jekoMethodForChannel(
  channel: PaymentMode
): JekoPaymentMethod | null {
  return MODE_TO_JEKO[channel] ?? null;
}

export function canTransferVia(channel: PaymentMode): boolean {
  return jekoMethodForChannel(channel) !== null;
}

/**
 * Valide la destination d'un remboursement et renvoie le numéro normalisé (E.164)
 * pour un transfert Jèko, null pour une remise en main propre.
 */
export function resolveDestination(args: {
  delivery: 'JEKO_TRANSFER' | 'MANUAL';
  channel: PaymentMode;
  phone: string | null | undefined;
}): string | null {
  if (args.delivery === 'MANUAL') {
    const raw = args.phone?.trim();
    return raw ? normalizeIvorianPhone(raw) : null;
  }
  if (!canTransferVia(args.channel)) {
    throw new RefundError(
      'Ce canal ne permet pas de transfert Jèko : choisissez Wave, Orange, MTN, Moov ou Djamo, ou une remise à la main'
    );
  }
  const phone = args.phone ? normalizeIvorianPhone(args.phone) : null;
  if (!phone) {
    throw new RefundError('Numéro de téléphone invalide pour le transfert');
  }
  return phone;
}
