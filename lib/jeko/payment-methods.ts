// lib/jeko/payment-methods.ts
//
// Moyens de paiement proposés au checkout : liste UNIQUE, partagée par le schéma
// serveur, le sélecteur du checkout et le client Jèko. Sans import serveur : ce
// module est aussi chargé côté navigateur.
//
// `bank` et `jeko` existent chez Jèko mais ne sont pas proposés (cf.
// lib/jeko/payment-mode.ts : ils sont encaissés comme OTHER).

import type { PaymentMode } from '@/generated/prisma/client';
import { PAYMENT_MODE_LABELS } from '@/lib/payment-modes';

export const JEKO_PAYMENT_METHODS = [
  'wave',
  'orange',
  'mtn',
  'moov',
  'djamo',
] as const;

export type JekoPaymentMethod = (typeof JEKO_PAYMENT_METHODS)[number];

/** Libellés identiques à ceux de la caisse et des stats (PAYMENT_MODE_LABELS). */
export const JEKO_PAYMENT_METHOD_LABELS: Record<JekoPaymentMethod, string> = {
  wave: PAYMENT_MODE_LABELS.WAVE,
  orange: PAYMENT_MODE_LABELS.ORANGE_MONEY,
  mtn: PAYMENT_MODE_LABELS.MTN_MONEY,
  moov: PAYMENT_MODE_LABELS.MOOV_MONEY,
  djamo: PAYMENT_MODE_LABELS.DJAMO,
};

/** Pour réutiliser `PaymentMethodIcon`/`PaymentMethodBadge` (logos) au checkout. */
export const JEKO_TO_PAYMENT_MODE: Record<JekoPaymentMethod, PaymentMode> = {
  wave: 'WAVE',
  orange: 'ORANGE_MONEY',
  mtn: 'MTN_MONEY',
  moov: 'MOOV_MONEY',
  djamo: 'DJAMO',
};
