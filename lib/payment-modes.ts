// lib/payment-modes.ts
//
// SOURCE UNIQUE des modes de paiement côté code. Le miroir de l'enum Prisma
// `PaymentMode` : `lib/payment-modes.test.ts` échoue si les deux divergent.
// Pour ajouter un mode : l'enum Prisma, puis cette liste et ses libellés — le
// compilateur signale ensuite chaque `Record<PaymentMode, …>` à compléter.

import type { PaymentMode } from '@/generated/prisma/client';

export const PAYMENT_MODES = [
  'CASH',
  'WAVE',
  'ORANGE_MONEY',
  'MTN_MONEY',
  'MOOV_MONEY',
  'DJAMO',
  'OTHER',
] as const satisfies readonly PaymentMode[];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MONEY: 'MTN Money',
  MOOV_MONEY: 'Moov Money',
  DJAMO: 'Djamo',
  OTHER: 'Autre',
};

/** Un compteur à zéro par mode — neuf à chaque appel (jamais partagé). */
export function emptyModeRecord(): Record<PaymentMode, number> {
  return Object.fromEntries(PAYMENT_MODES.map((m) => [m, 0])) as Record<
    PaymentMode,
    number
  >;
}
