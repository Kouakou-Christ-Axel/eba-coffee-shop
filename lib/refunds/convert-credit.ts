// lib/refunds/convert-credit.ts
//
// Conversion d'un avoir en argent : le client préfère finalement être payé. C'est
// un remboursement ordinaire (demande → validation admin → Jèko / main propre) qui
// DÉBITE le solde d'avoir à la demande, puis le rend s'il est refusé ou annulé.
//
// Comptablement l'avoir a déjà retiré le CA (émission) : la conversion ne le retire
// pas une 2e fois et n'entame pas le plafond de la commande — `creditSourceId`
// la distingue (lib/refunds/aggregate.ts, cap.ts) ; la trésorerie, elle, compte
// bien l'argent sorti.

import prisma from '@/lib/prisma';
import type { Prisma, Refund } from '@/generated/prisma/client';
import { priceFormatter } from '@/config/menu';
import { REFUND_REQUEST_ROLES } from '@/config/constants';
import { moveCredit } from '@/lib/credits/ledger';
import {
  ACTIVE_REFUND_STATUSES,
  convertCreditSchema,
} from '@/lib/schemas/refund';
import { alertApprovers } from './create';
import { resolveDestination } from './destination';
import { RefundError, type RefundRequester } from './errors';
import { logRefundEvent } from './events';

/** Part de l'avoir `refundId` pas encore convertie en argent. */
export async function getConvertibleCredit(
  tx: Prisma.TransactionClient,
  refundId: string
): Promise<number> {
  const source = await tx.refund.findUnique({
    where: { id: refundId },
    select: { amount: true, delivery: true, status: true },
  });
  if (
    !source ||
    source.delivery !== 'STORE_CREDIT' ||
    source.status !== 'PAID'
  ) {
    return 0;
  }
  const used = await tx.refund.aggregate({
    where: {
      creditSourceId: refundId,
      status: { in: ACTIVE_REFUND_STATUSES },
    },
    _sum: { amount: true },
  });
  return Math.max(0, source.amount - (used._sum.amount ?? 0));
}

export async function convertCreditToRefund(
  rawInput: unknown,
  actor: RefundRequester
): Promise<Refund> {
  if (!REFUND_REQUEST_ROLES.includes(actor.role)) {
    throw new RefundError('Non autorisé à demander un remboursement', 403);
  }
  const input = convertCreditSchema.parse(rawInput);

  const refund = await prisma.$transaction(async (tx) => {
    const source = await tx.refund.findUnique({
      where: { id: input.sourceRefundId },
      select: {
        orderId: true,
        customerName: true,
        order: { select: { customerId: true, customerPhone: true } },
      },
    });
    if (!source) throw new RefundError('Avoir introuvable', 404);
    const customerId = source.order.customerId;
    if (!customerId) throw new RefundError('Cet avoir n’a pas de client');

    // Même verrou que `createRefund` : deux conversions simultanées se serrent.
    await tx.$queryRaw`SELECT "id" FROM "order" WHERE "id" = ${source.orderId} FOR UPDATE`;
    const convertible = await getConvertibleCredit(tx, input.sourceRefundId);
    if (input.amount > convertible) {
      throw new RefundError(
        `Montant trop élevé : ${priceFormatter.format(convertible)} F de cet avoir sont convertibles`,
        409
      );
    }
    const destinationPhone = resolveDestination({
      delivery: input.delivery,
      channel: input.channel,
      phone: input.destinationPhone ?? source.order.customerPhone,
    });

    const created = await tx.refund.create({
      data: {
        orderId: source.orderId,
        amount: input.amount,
        reason: 'OTHER',
        note: input.note || 'Conversion d’avoir en argent',
        source: 'STAFF',
        status: 'REQUESTED',
        delivery: input.delivery,
        channel: input.channel,
        destinationPhone,
        customerId,
        customerName: source.customerName,
        requestedById: actor.id,
        creditSourceId: input.sourceRefundId,
      },
    });
    // Débité tout de suite : le client ne peut pas dépenser ce qu'on s'apprête à lui rendre.
    await moveCredit(tx, {
      customerId,
      delta: -input.amount,
      kind: 'CONVERTED',
      refundId: created.id,
      orderId: source.orderId,
      note: 'Avoir converti en argent',
      actorId: actor.id,
    });
    await logRefundEvent(tx, {
      refundId: created.id,
      actorId: actor.id,
      from: null,
      to: 'REQUESTED',
      note: input.note ?? 'Conversion d’avoir en argent',
    });
    return created;
  });

  alertApprovers(refund, actor);
  return refund;
}

/** Refusée ou annulée : la somme réservée sur le solde retourne au client. */
export async function releaseConvertedCredit(
  tx: Prisma.TransactionClient,
  refund: Pick<Refund, 'id' | 'amount' | 'customerId' | 'creditSourceId'>,
  actorId: string | null
): Promise<void> {
  if (!refund.creditSourceId || !refund.customerId) return;
  await moveCredit(tx, {
    customerId: refund.customerId,
    delta: refund.amount,
    kind: 'RESTORED',
    refundId: refund.id,
    note: 'Conversion refusée ou annulée',
    actorId,
  });
}
