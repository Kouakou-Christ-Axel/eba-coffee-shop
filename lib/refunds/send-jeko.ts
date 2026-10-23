// lib/refunds/send-jeko.ts
//
// Envoi d'un remboursement approuvé par transfert Jèko (contact + transfert).
//
// Règle d'or : ne JAMAIS envoyer deux fois. Le remboursement est réclamé
// (APPROVED → PROCESSING, `attempt` + 1) AVANT l'appel réseau ; la référence
// `REMB-<id>-<essai>` est unique par essai. Ce qui suit dépend de ce qu'on sait :
//   - échec avant tout transfert (config, contact refusé, 4xx)  → FAILED, on peut
//     corriger et renvoyer ;
//   - timeout / 5xx / 409 PENDANT le transfert (on ignore s'il est parti) →
//     UNCERTAIN : jamais de renvoi automatique, un admin vérifie chez Jèko.

import prisma from '@/lib/prisma';
import { parseJekoAccount } from '@/lib/jeko/accounts';
import { jekoConfig } from '@/lib/jeko/config';
import { JekoApiError } from '@/lib/jeko/client';
import {
  createJekoContact,
  createJekoTransfer,
  minTransferFcfa,
} from '@/lib/jeko/transfers';
import { describeTransferFailure } from '@/lib/jeko/transfer-errors';
import { normalizeIvorianPhone } from '@/lib/phone';
import { notifyRefundProblem } from './alerts';
import { jekoMethodForChannel } from './destination';
import { transitionRefund } from './events';
import { settleRefundPaid } from './on-paid';

export type SendOutcome =
  | 'paid'
  | 'processing'
  | 'failed'
  | 'uncertain'
  | 'skipped';

export function refundReference(refundId: string, attempt: number): string {
  return `REMB-${refundId}-${attempt}`;
}

async function fail(
  id: string,
  from: 'PROCESSING',
  code: string,
  message?: string
): Promise<SendOutcome> {
  const advice = describeTransferFailure(code);
  await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id,
      from: [from],
      to: 'FAILED',
      actorId: null,
      note: `${advice.message}${message ? ` — ${message}` : ''}`,
      data: { failureCode: code, failureMessage: message ?? advice.message },
    })
  );
  await notifyRefundProblem(id, 'FAILED');
  return 'failed';
}

async function uncertain(id: string, why: string): Promise<SendOutcome> {
  await prisma.$transaction((tx) =>
    transitionRefund(tx, {
      id,
      from: ['PROCESSING'],
      to: 'UNCERTAIN',
      actorId: null,
      note: why,
      data: { failureCode: 'uncertain', failureMessage: why },
    })
  );
  await notifyRefundProblem(id, 'UNCERTAIN');
  return 'uncertain';
}

/** Un échec de l'API Jèko est-il « on ne sait pas si c'est parti » ? */
function isAmbiguous(err: unknown): boolean {
  return (
    err instanceof JekoApiError &&
    (err.status === 409 || err.status >= 500 || err.code === 'network_error')
  );
}

export async function sendRefundViaJeko(id: string): Promise<SendOutcome> {
  // Réclamation atomique : un double clic ou un rejeu ne passe qu'une fois.
  const claim = await prisma.refund.updateMany({
    where: { id, status: 'APPROVED', delivery: 'JEKO_TRANSFER' },
    data: { status: 'PROCESSING', attempt: { increment: 1 } },
  });
  if (claim.count === 0) return 'skipped';
  await prisma.refundEvent.create({
    data: { refundId: id, fromStatus: 'APPROVED', toStatus: 'PROCESSING' },
  });

  const refund = await prisma.refund.findUniqueOrThrow({
    where: { id },
    select: {
      amount: true,
      channel: true,
      destinationPhone: true,
      customerName: true,
      attempt: true,
      order: { select: { reference: true, jekoAccount: true } },
    },
  });

  // Le compte qui a encaissé la commande, pas le compte actif.
  const config = jekoConfig(parseJekoAccount(refund.order.jekoAccount));
  if (!config) return fail(id, 'PROCESSING', 'jeko_not_configured');

  const method = jekoMethodForChannel(refund.channel);
  const phone = refund.destinationPhone
    ? normalizeIvorianPhone(refund.destinationPhone)
    : null;
  if (!method || !phone) return fail(id, 'PROCESSING', 'invalid_destination');
  if (refund.amount < minTransferFcfa(method)) {
    return fail(
      id,
      'PROCESSING',
      'validation_error',
      `Montant sous le minimum du transfert (${minTransferFcfa(method)} F)`
    );
  }

  let contactId: string;
  try {
    ({ id: contactId } = await createJekoContact(config, {
      name: refund.customerName?.trim() || 'Client EBA',
      method,
      phoneE164: phone,
    }));
  } catch (err) {
    // Aucun transfert n'a été tenté : sûr de réessayer.
    const code = err instanceof JekoApiError ? err.code : 'unknown';
    return fail(
      id,
      'PROCESSING',
      code,
      err instanceof Error ? err.message : undefined
    );
  }

  try {
    const transfer = await createJekoTransfer(config, {
      contactId,
      amountFcfa: refund.amount,
      reference: refundReference(id, refund.attempt),
      description: `Remboursement commande ${refund.order.reference}`,
    });
    if (transfer.status === 'error') {
      return fail(id, 'PROCESSING', 'transfer_failed');
    }
    // L'identifiant est noté tout de suite : plus aucun doute sur l'existence du transfert.
    await prisma.refund.update({
      where: { id },
      data: {
        jekoTransferId: transfer.id,
        feeFcfa: Math.round(transfer.feeFcfa),
      },
    });
    if (transfer.status === 'success') {
      await settleRefundPaid({
        id,
        from: ['PROCESSING'],
        actorId: null,
        jekoTransferId: transfer.id,
        feeFcfa: Math.round(transfer.feeFcfa),
      });
      return 'paid';
    }
    return 'processing';
  } catch (err) {
    if (isAmbiguous(err)) {
      return uncertain(
        id,
        err instanceof Error ? err.message : 'Réponse de Jèko perdue'
      );
    }
    const code = err instanceof JekoApiError ? err.code : 'unknown';
    return fail(
      id,
      'PROCESSING',
      code,
      err instanceof Error ? err.message : undefined
    );
  }
}
