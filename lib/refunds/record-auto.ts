// lib/refunds/record-auto.ts
//
// Trace, dans la table des remboursements, le remboursement AUTOMATIQUE d'un
// paiement Jèko tardif (lib/jeko/refund.ts). Sans cette ligne il resterait
// invisible dans l'écran, les stats et le solde Jèko. Un échec devient `FAILED`
// pour apparaître dans « À corriger » : l'admin peut corriger le numéro ou
// réessayer par le circuit normal.

import prisma from '@/lib/prisma';
import type { PaymentMode, RefundStatus } from '@/generated/prisma/client';
import { todayDailyDate } from '@/lib/daily-numbering';
import { normalizeIvorianPhone } from '@/lib/phone';

export type AutoRefundResult =
  | {
      kind: 'sent';
      status: 'success' | 'pending';
      transferId: string;
      fee: number;
    }
  /** 409 : le transfert existe déjà, on ignore son issue. */
  | { kind: 'exists' }
  | { kind: 'failed'; reason: string };

export async function recordAutoLateRefund(args: {
  orderId: string;
  customerName: string | null;
  customerPhone: string | null;
  channel: PaymentMode;
  amount: number;
  result: AutoRefundResult;
}): Promise<void> {
  const { result } = args;
  // Livraison rejouée : la ligne existe déjà.
  const existing = await prisma.refund.findFirst({
    where: { orderId: args.orderId, source: 'AUTO_LATE' },
    select: { id: true },
  });
  if (existing) return;

  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    select: { customerId: true },
  });
  const status: RefundStatus =
    result.kind === 'failed'
      ? 'FAILED'
      : result.kind === 'exists'
        ? 'UNCERTAIN'
        : result.status === 'success'
          ? 'PAID'
          : 'PROCESSING';
  const sent = result.kind === 'sent';
  const now = new Date();

  await prisma.refund.create({
    data: {
      orderId: args.orderId,
      amount: args.amount,
      reason: 'LATE_PAYMENT',
      source: 'AUTO_LATE',
      status,
      delivery: 'JEKO_TRANSFER',
      channel: args.channel,
      destinationPhone: args.customerPhone
        ? normalizeIvorianPhone(args.customerPhone)
        : null,
      customerId: order?.customerId ?? null,
      customerName: args.customerName,
      attempt: sent || result.kind === 'exists' ? 1 : 0,
      jekoTransferId: sent ? result.transferId : null,
      feeFcfa: sent ? result.fee : 0,
      failureCode:
        result.kind === 'failed'
          ? 'auto_failed'
          : result.kind === 'exists'
            ? 'uncertain'
            : null,
      failureMessage: result.kind === 'failed' ? result.reason : null,
      paidAt: status === 'PAID' ? now : null,
      payoutDate: status === 'PAID' ? todayDailyDate() : null,
      events: {
        create: {
          toStatus: status,
          note: 'Paiement tardif : remboursement automatique',
        },
      },
    },
  });
}
