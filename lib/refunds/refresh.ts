// lib/refunds/refresh.ts
//
// Suivi opportuniste des transferts Jèko en cours (pas de cron : même principe que
// `expirePendingOrders`). Un transfert créé `pending` finit `success` ou `error`
// sans nous prévenir ; on le relit ici, au chargement du dashboard et de l'écran
// Remboursements.

import prisma from '@/lib/prisma';
import { REFUND_PROCESSING_STALE_MINUTES } from '@/config/constants';
import { jekoConfig } from '@/lib/jeko/config';
import { getJekoTransfer } from '@/lib/jeko/transfers';
import { notifyRefundProblem } from './alerts';
import { transitionRefund } from './events';
import { settleRefundPaid } from './on-paid';

const THROTTLE_MS = 60_000;
const BATCH_SIZE = 20;
let lastRunAt = 0;

export type RefreshResult = { paid: number; failed: number; uncertain: number };

export async function refreshPendingRefunds(
  now: Date = new Date()
): Promise<RefreshResult> {
  const result: RefreshResult = { paid: 0, failed: 0, uncertain: 0 };
  if (now.getTime() - lastRunAt < THROTTLE_MS) return result;
  lastRunAt = now.getTime();

  const pending = await prisma.refund.findMany({
    where: { status: 'PROCESSING' },
    select: { id: true, jekoTransferId: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
    take: BATCH_SIZE,
  });
  const config = jekoConfig();
  const staleBefore = now.getTime() - REFUND_PROCESSING_STALE_MINUTES * 60_000;

  for (const refund of pending) {
    try {
      if (!refund.jekoTransferId) {
        // Réclamé mais jamais confirmé : la réponse de Jèko s'est perdue.
        if (refund.updatedAt.getTime() < staleBefore) {
          const moved = await prisma.$transaction((tx) =>
            transitionRefund(tx, {
              id: refund.id,
              from: ['PROCESSING'],
              to: 'UNCERTAIN',
              actorId: null,
              note: 'Aucune réponse de Jèko enregistrée',
              data: { failureCode: 'uncertain' },
            })
          );
          if (moved) {
            result.uncertain++;
            await notifyRefundProblem(refund.id, 'UNCERTAIN');
          }
        }
        continue;
      }
      if (!config) continue;
      const transfer = await getJekoTransfer(config, refund.jekoTransferId);
      if (transfer.status === 'success') {
        if (
          await settleRefundPaid({
            id: refund.id,
            from: ['PROCESSING'],
            actorId: null,
            feeFcfa: Math.round(transfer.feeFcfa),
          })
        ) {
          result.paid++;
        }
      } else if (transfer.status === 'error') {
        const code = transfer.errorCode ?? 'transfer_failed';
        const moved = await prisma.$transaction((tx) =>
          transitionRefund(tx, {
            id: refund.id,
            from: ['PROCESSING'],
            to: 'FAILED',
            actorId: null,
            note: `Échec du transfert (${code})`,
            data: { failureCode: code, failureMessage: null },
          })
        );
        if (moved) {
          result.failed++;
          await notifyRefundProblem(refund.id, 'FAILED');
        }
      }
    } catch (err) {
      // Jèko injoignable : on réessaiera au prochain passage.
      console.error(`[refunds] suivi de ${refund.id} reporté :`, err);
    }
  }
  return result;
}
