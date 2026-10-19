// lib/refunds/events.ts
//
// Journal des remboursements et transition gardée sur le statut.

import type { Prisma, RefundStatus } from '@/generated/prisma/client';
import { RefundError } from './errors';

export async function logRefundEvent(
  tx: Prisma.TransactionClient,
  args: {
    refundId: string;
    actorId: string | null;
    from: RefundStatus | null;
    to: RefundStatus;
    note?: string | null;
  }
): Promise<void> {
  await tx.refundEvent.create({
    data: {
      refundId: args.refundId,
      actorId: args.actorId,
      fromStatus: args.from,
      toStatus: args.to,
      note: args.note || null,
    },
  });
}

/**
 * Change le statut SEULEMENT si le remboursement est encore dans l'un des statuts
 * attendus (`updateMany` gardé) : un double clic, un rejeu ou deux personnes en
 * même temps ne l'appliquent qu'une fois. Renvoie false si la garde a échoué.
 */
export async function transitionRefund(
  tx: Prisma.TransactionClient,
  args: {
    id: string;
    from: RefundStatus[];
    to: RefundStatus;
    actorId: string | null;
    note?: string | null;
    data?: Prisma.RefundUncheckedUpdateManyInput;
    where?: Prisma.RefundWhereInput;
  }
): Promise<{ from: RefundStatus } | null> {
  const current = await tx.refund.findUnique({
    where: { id: args.id },
    select: { status: true },
  });
  if (!current) throw new RefundError('Remboursement introuvable', 404);
  if (!args.from.includes(current.status)) return null;

  const { count } = await tx.refund.updateMany({
    where: { id: args.id, status: current.status, ...(args.where ?? {}) },
    data: { status: args.to, ...(args.data ?? {}) },
  });
  if (count === 0) return null;

  await logRefundEvent(tx, {
    refundId: args.id,
    actorId: args.actorId,
    from: current.status,
    to: args.to,
    note: args.note,
  });
  return { from: current.status };
}
