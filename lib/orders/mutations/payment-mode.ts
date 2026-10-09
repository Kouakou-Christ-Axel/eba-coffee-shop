// Mutations de commandes — payment-mode.

import type { PaymentMode } from '@/generated/prisma/client';
import type { OrderPaymentLineInput } from '@/lib/schemas/order';

export function resolvePaymentMode(
  payments: OrderPaymentLineInput[]
): PaymentMode | null {
  const distinctModes = new Set(payments.map((p) => p.mode));
  return distinctModes.size === 1 ? payments[0].mode : null;
}
