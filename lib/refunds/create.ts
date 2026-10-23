// lib/refunds/create.ts
//
// Création d'une demande de remboursement. Tout se joue dans UNE transaction qui
// verrouille la ligne de la commande : deux demandes simultanées lisent chacune le
// restant à jour et ne peuvent pas dépasser, ensemble, ce qui a été encaissé.

import prisma from '@/lib/prisma';
import type { PaymentMode, Refund } from '@/generated/prisma/client';
import {
  REFUND_APPROVER_ROLES,
  REFUND_REQUEST_ROLES,
} from '@/config/constants';
import type { CartItem } from '@/lib/cart-store';
import { sendPushToRoles } from '@/lib/push-notify';
import { priceFormatter } from '@/config/menu';
import { createRefundSchema } from '@/lib/schemas/refund';
import { getRefundCap } from './cap';
import {
  canTransferVia,
  resolveChannel,
  resolveDestination,
} from './destination';
import { RefundError, type RefundRequester } from './errors';
import { logRefundEvent } from './events';
import { validateRefundLines } from './lines';

/** Canal par défaut : le mode du client, ou celui de la plus grosse ligne encaissée. */
function defaultChannel(
  paymentMode: PaymentMode | null,
  payments: { mode: PaymentMode; amount: number }[]
): PaymentMode {
  if (paymentMode && paymentMode !== 'AVOIR') return paymentMode;
  const biggest = [...payments]
    .filter((p) => p.mode !== 'AVOIR')
    .sort((a, b) => b.amount - a.amount)[0];
  return biggest?.mode ?? 'CASH';
}

/** Un admin qui demande lui-même n'a pas besoin d'être prévenu. */
export function alertApprovers(
  refund: Pick<Refund, 'id' | 'amount'>,
  actor: RefundRequester
): void {
  if (REFUND_APPROVER_ROLES.includes(actor.role)) return;
  sendPushToRoles(REFUND_APPROVER_ROLES, {
    title: 'Remboursement à valider',
    body: `${priceFormatter.format(refund.amount)} F demandés`,
    url: '/dashboard/remboursements',
    tag: `refund-${refund.id}`,
  }).catch((err) => {
    console.error('[refunds] alerte admin échouée :', err);
  });
}

export async function createRefund(
  rawInput: unknown,
  actor: RefundRequester
): Promise<Refund> {
  if (!REFUND_REQUEST_ROLES.includes(actor.role)) {
    throw new RefundError('Non autorisé à demander un remboursement', 403);
  }
  const input = createRefundSchema.parse(rawInput);
  if (input.restockItems && input.lines.length === 0) {
    throw new RefundError(
      'Choisissez les lignes à remettre en stock (produits ou suppléments)'
    );
  }

  const refund = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "order" WHERE "id" = ${input.orderId} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        items: true,
        paymentMode: true,
        paymentTransactionId: true,
        customerId: true,
        customerName: true,
        customerPhone: true,
        payments: { select: { mode: true, amount: true } },
      },
    });
    if (!order) throw new RefundError('Commande introuvable', 404);

    const cap = await getRefundCap(tx, order.id);
    if (cap.paid === 0) {
      throw new RefundError('Aucun paiement encaissé sur cette commande');
    }
    if (input.amount > cap.remaining) {
      throw new RefundError(
        `Montant trop élevé : il reste ${priceFormatter.format(cap.remaining)} F remboursables sur cette commande`,
        409
      );
    }
    validateRefundLines(
      order.items as unknown as CartItem[],
      input.lines,
      input.amount
    );

    const baseChannel =
      input.channel ?? defaultChannel(order.paymentMode, order.payments);
    // Payée via Jèko → on renvoie par Jèko ; sinon remise à la main.
    const delivery =
      input.delivery ??
      (order.paymentTransactionId && canTransferVia(baseChannel)
        ? 'JEKO_TRANSFER'
        : 'MANUAL');
    if (delivery === 'STORE_CREDIT' && !order.customerId) {
      throw new RefundError(
        'Un avoir se rattache à un client : cette commande n’en a pas (pas de numéro de téléphone)'
      );
    }
    const channel = resolveChannel(delivery, baseChannel);
    const destinationPhone = resolveDestination({
      delivery,
      channel,
      phone: input.destinationPhone ?? order.customerPhone,
    });

    const created = await tx.refund.create({
      data: {
        orderId: order.id,
        amount: input.amount,
        reason: input.reason,
        note: input.note || null,
        source: 'STAFF',
        status: 'REQUESTED',
        delivery,
        channel,
        destinationPhone,
        customerId: order.customerId,
        customerName: order.customerName,
        requestedById: actor.id,
        restockItems: input.restockItems,
        lines: {
          create: input.lines.map((l) => ({
            cartId: l.cartId,
            productId: l.productId,
            name: l.name,
            kind: l.kind,
            groupName: l.groupName ?? null,
            optionName: l.optionName ?? null,
            quantity: l.quantity,
            amount: l.amount,
          })),
        },
      },
    });
    await logRefundEvent(tx, {
      refundId: created.id,
      actorId: actor.id,
      from: null,
      to: 'REQUESTED',
      note: input.note,
    });
    return created;
  });

  alertApprovers(refund, actor);
  return refund;
}
