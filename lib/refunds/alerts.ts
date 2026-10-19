// lib/refunds/alerts.ts
//
// Alertes staff d'un remboursement qui coince. Fire-and-forget : une panne de push
// ne doit jamais faire échouer la mutation.

import prisma from '@/lib/prisma';
import { REFUND_APPROVER_ROLES } from '@/config/constants';
import { priceFormatter } from '@/config/menu';
import { sendPushToRoles } from '@/lib/push-notify';
import { describeTransferFailure } from '@/lib/jeko/transfer-errors';

export async function notifyRefundProblem(
  id: string,
  kind: 'FAILED' | 'UNCERTAIN'
): Promise<void> {
  try {
    const refund = await prisma.refund.findUnique({
      where: { id },
      select: { amount: true, failureCode: true },
    });
    if (!refund) return;
    const advice = describeTransferFailure(refund.failureCode);
    await sendPushToRoles(REFUND_APPROVER_ROLES, {
      title:
        kind === 'UNCERTAIN'
          ? 'Remboursement à vérifier'
          : 'Remboursement en échec',
      body:
        kind === 'UNCERTAIN'
          ? `${priceFormatter.format(refund.amount)} F : on ignore si le transfert est parti. Vérifier chez Jèko.`
          : `${priceFormatter.format(refund.amount)} F : ${advice.message}. ${advice.action}`,
      url: '/dashboard/remboursements',
      tag: `refund-${id}`,
    });
  } catch (err) {
    console.error('[refunds] alerte échouée :', err);
  }
}
