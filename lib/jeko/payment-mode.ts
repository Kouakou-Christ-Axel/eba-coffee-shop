// lib/jeko/payment-mode.ts
//
// Traduction du moyen de paiement nommé par Jèko (`paymentMethod` du webhook et
// de la lecture d'une demande) vers notre `PaymentMode`. Tout moyen non proposé
// au checkout (`bank`, `jeko`) ou inconnu tombe dans OTHER : le paiement est
// encaissé, jamais perdu faute de correspondance.

import type { PaymentMode } from '@/generated/prisma/client';

const BY_JEKO_METHOD: Record<string, PaymentMode> = {
  wave: 'WAVE',
  orange: 'ORANGE_MONEY',
  mtn: 'MTN_MONEY',
  moov: 'MOOV_MONEY',
  djamo: 'DJAMO',
};

export function jekoMethodToPaymentMode(
  method: string | null | undefined
): PaymentMode {
  return (method && BY_JEKO_METHOD[method]) || 'OTHER';
}
